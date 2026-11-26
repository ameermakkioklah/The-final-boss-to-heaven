import {
  CORE_CUTSCENE_VOICE_CUES,
  type CutsceneSfxHook,
  type DialogueCue,
} from './cutscene';
import { sound } from './sound';

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binStr = window.atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

export class CutsceneVoiceController {
  private muted = false;
  private audioCtx: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private rawCache = new Map<string, ArrayBuffer>();
  private inFlightFetches = new Map<string, Promise<ArrayBuffer | null>>();
  private activeSource: AudioBufferSourceNode | null = null;
  private activeCueNonce = 0;
  private preloaded = false;
  private voiceApiDisabled = false;

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private getCacheKey(cue: DialogueCue): string {
    return `${cue.speaker}:${cue.id}:${cue.text}`;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopSpeech();
    }
  }

  public stopSpeech(): void {
    this.activeCueNonce += 1;
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Already stopped
      }
      this.activeSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech synthesis cancellation errors
      }
    }
  }

  public preloadCutsceneVoices(): void {
    if (this.preloaded || this.voiceApiDisabled || typeof window === 'undefined') return;
    this.preloaded = true;
    // Warm up intro + ending voice lines sequentially in the background
    void (async () => {
      for (const cue of CORE_CUTSCENE_VOICE_CUES) {
        if (this.voiceApiDisabled) break;
        await this.fetchOrGetRawWav(cue);
      }
    })();
  }

  public triggerSfx(hook: CutsceneSfxHook): void {
    switch (hook) {
      case 'blade_scrape':
        sound.playBladeScrape();
        break;
      case 'dragon_laugh':
        sound.playDragonLaugh();
        break;
      case 'dragon_blink':
        sound.playWyvernTelegraph('blink', true);
        break;
      case 'ambush_hit':
        sound.playHitImpact(true);
        break;
      case 'warrior_chuckle':
        sound.playWarriorChuckle();
        break;
      case 'warrior_stance':
        sound.playComboSlash(1, false, 'broadsword');
        break;
      case 'decapitate':
        sound.playDecapitateSlash();
        break;
      case 'dragon_devour':
        sound.playDragonDevour();
        break;
    }
  }

  public speakDialogue(cue: DialogueCue | null): void {
    if (!cue || this.muted) return;

    if (cue.isBanter) {
      sound.playDragonSnarl(false);
    }

    this.stopSpeech();
    const myNonce = ++this.activeCueNonce;

    void this.playGeminiVoiceOrFallback(cue, myNonce);
  }

  private async fetchOrGetRawWav(cue: DialogueCue): Promise<ArrayBuffer | null> {
    if (this.voiceApiDisabled) return null;
    const key = this.getCacheKey(cue);
    const cachedRaw = this.rawCache.get(key);
    if (cachedRaw) return cachedRaw;

    const existing = this.inFlightFetches.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const resp = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cueId: cue.id,
            speaker: cue.speaker,
            text: cue.text,
            delivery: cue.delivery,
            isBanter: Boolean(cue.isBanter),
          }),
        });
        if (!resp.ok) {
          if (resp.status === 503) {
            // Server does not have GEMINI_API_KEY configured; avoid retrying every line
            this.voiceApiDisabled = true;
          }
          return null;
        }
        const json = (await resp.json()) as { audioBase64?: string };
        if (!json.audioBase64) return null;
        const buf = decodeBase64ToArrayBuffer(json.audioBase64);
        this.rawCache.set(key, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.inFlightFetches.delete(key);
      }
    })();

    this.inFlightFetches.set(key, promise);
    return promise;
  }

  private async playGeminiVoiceOrFallback(cue: DialogueCue, nonce: number): Promise<void> {
    const key = this.getCacheKey(cue);
    const ctx = this.ensureAudioContext();

    if (ctx) {
      let decoded = this.bufferCache.get(key);
      if (!decoded) {
        const raw = await this.fetchOrGetRawWav(cue);
        if (this.muted || nonce !== this.activeCueNonce) return;
        if (raw) {
          try {
            // decodeAudioData detaches the passed ArrayBuffer, so slice a fresh copy
            decoded = await ctx.decodeAudioData(raw.slice(0));
            this.bufferCache.set(key, decoded);
          } catch {
            decoded = undefined;
          }
        }
      }

      if (this.muted || nonce !== this.activeCueNonce) return;

      if (decoded) {
        this.playProcessedAudioBuffer(ctx, decoded, cue);
        return;
      }
    }

    if (!this.muted && nonce === this.activeCueNonce) {
      this.speakFallbackSpeechSynthesis(cue);
    }
  }

  private playProcessedAudioBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    cue: DialogueCue,
  ): void {
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const masterGain = ctx.createGain();
      if (cue.speaker === 'warrior') {
        // Close-mic raw vocal performance with subtle low chest grit & minimal room reverb
        masterGain.gain.value = cue.delivery === 'tremble' ? 0.72 : 0.96;

        const lowGrit = ctx.createBiquadFilter();
        lowGrit.type = 'lowshelf';
        lowGrit.frequency.value = 140;
        lowGrit.gain.value = 2.2;

        const breathClarity = ctx.createBiquadFilter();
        breathClarity.type = 'highshelf';
        breathClarity.frequency.value = 3400;
        breathClarity.gain.value = 1.6;

        source.connect(lowGrit);
        lowGrit.connect(breathClarity);
        breathClarity.connect(masterGain);
        masterGain.connect(ctx.destination);
      } else {
        // Monstrous cavernous bass presence + tight filtered cave slapback for intelligibility
        masterGain.gain.value = cue.isBanter ? 0.74 : 0.95;

        const bassBoost = ctx.createBiquadFilter();
        bassBoost.type = 'lowshelf';
        bassBoost.frequency.value = 125;
        bassBoost.gain.value = 5.5;

        const clarityPeak = ctx.createBiquadFilter();
        clarityPeak.type = 'peaking';
        clarityPeak.frequency.value = 2200;
        clarityPeak.Q.value = 1.1;
        clarityPeak.gain.value = 2.0;

        // Subtle cavernous reflection so every English word stays crisp
        const cavernDelay = ctx.createDelay(0.25);
        cavernDelay.delayTime.value = 0.068;
        const cavernFilter = ctx.createBiquadFilter();
        cavernFilter.type = 'lowpass';
        cavernFilter.frequency.value = 880;
        const cavernGain = ctx.createGain();
        cavernGain.gain.value = 0.24;

        source.connect(bassBoost);
        bassBoost.connect(clarityPeak);
        clarityPeak.connect(masterGain);

        clarityPeak.connect(cavernDelay);
        cavernDelay.connect(cavernFilter);
        cavernFilter.connect(cavernGain);
        cavernGain.connect(masterGain);

        masterGain.connect(ctx.destination);
      }

      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
        }
      };
      this.activeSource = source;
      source.start(0);
    } catch {
      this.speakFallbackSpeechSynthesis(cue);
    }
  }

  private speakFallbackSpeechSynthesis(cue: DialogueCue): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(cue.text);
      utter.lang = 'en-US';

      const voices = synth.getVoices();
      const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
      const preferredMale =
        englishVoices.find((v) =>
          /david|daniel|mark|george|alex|fred|arthur|ryan|guy/i.test(v.name),
        ) || englishVoices[0];
      if (preferredMale) {
        utter.voice = preferredMale;
      }

      if (cue.speaker === 'dragon') {
        utter.pitch = 0.52;
        utter.rate = cue.id === 'dragon_die' ? 1.12 : 0.82;
        utter.volume = cue.isBanter ? 0.55 : 0.85;
      } else if (cue.delivery === 'stammer' || cue.delivery === 'tremble') {
        utter.pitch = 0.76;
        utter.rate = 0.72;
        utter.volume = cue.delivery === 'tremble' ? 0.68 : 0.82;
      } else {
        utter.pitch = 0.74;
        utter.rate = 0.9;
        utter.volume = 0.85;
      }

      synth.speak(utter);
    } catch {
      // Ignore speech synthesis errors
    }
  }
}

export const cutsceneVoice = new CutsceneVoiceController();
