import {
  CORE_CUTSCENE_VOICE_CUES,
  loadCutsceneFlags,
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

export interface VoicePlaybackCallbacks {
  onStarted?: (cueId: string, durationSec?: number) => void;
  onEnded?: (cueId: string) => void;
  onError?: (message: string) => void;
}

interface FetchResult {
  buffer: ArrayBuffer | null;
  error?: string;
}

export class CutsceneVoiceController {
  private muted = false;
  private audioCtx: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private rawCache = new Map<string, ArrayBuffer>();
  private inFlightFetches = new Map<string, Promise<FetchResult>>();
  private activeSource: AudioBufferSourceNode | null = null;
  private activeCueNonce = 0;
  private preloaded = false;
  private voiceApiDisabled = false;
  private lastVoiceError: string | null = null;

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

  public getLastVoiceError(): string | null {
    return this.lastVoiceError;
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
        this.activeSource.onended = null;
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Already stopped
      }
      this.activeSource = null;
    }
  }

  public preloadCutsceneVoices(): void {
    if (this.preloaded || this.voiceApiDisabled || typeof window === 'undefined') return;
    this.preloaded = true;

    // Only preload opening intro lines when the player has not seen the intro yet, preserving TTS quota
    const flags = loadCutsceneFlags();
    if (flags.hasSeenIntroCutscene) return;

    const priorityCues = CORE_CUTSCENE_VOICE_CUES.slice(0, 3);
    void Promise.allSettled(priorityCues.map((cue) => this.fetchAndDecodeCue(cue)));
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

  public speakDialogue(cue: DialogueCue | null, callbacks?: VoicePlaybackCallbacks): void {
    if (!cue) return;

    if (this.muted) {
      callbacks?.onStarted?.(cue.id, cue.durationSec);
      globalThis.setTimeout(() => {
        callbacks?.onEnded?.(cue.id);
      }, Math.round(cue.durationSec * 1000));
      return;
    }

    if (cue.isBanter) {
      sound.playDragonSnarl(false);
    }

    this.stopSpeech();
    const myNonce = ++this.activeCueNonce;

    void this.playGeminiVoice(cue, myNonce, callbacks);
  }

  private async fetchAndDecodeCue(
    cue: DialogueCue,
  ): Promise<{ buffer: AudioBuffer | null; error?: string }> {
    const key = this.getCacheKey(cue);
    const cachedBuf = this.bufferCache.get(key);
    if (cachedBuf) return { buffer: cachedBuf };

    const result = await this.fetchOrGetRawWav(cue);
    if (!result.buffer) {
      return { buffer: null, error: result.error };
    }

    const ctx = this.ensureAudioContext();
    if (!ctx) {
      return { buffer: null, error: 'Web Audio API unavailable.' };
    }

    try {
      const decoded = await ctx.decodeAudioData(result.buffer.slice(0));
      this.bufferCache.set(key, decoded);
      return { buffer: decoded };
    } catch {
      return { buffer: null, error: 'Failed to decode voice WAV.' };
    }
  }

  private async fetchOrGetRawWav(cue: DialogueCue): Promise<FetchResult> {
    if (this.voiceApiDisabled) {
      return { buffer: null, error: this.lastVoiceError || 'Voice API disabled.' };
    }
    const key = this.getCacheKey(cue);
    const cachedRaw = this.rawCache.get(key);
    if (cachedRaw) return { buffer: cachedRaw };

    const existing = this.inFlightFetches.get(key);
    if (existing) return existing;

    const promise = (async (): Promise<FetchResult> => {
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
          let errMsg = `Voice server returned HTTP ${resp.status}`;
          try {
            const errJson = (await resp.json()) as { error?: string };
            if (errJson?.error) errMsg = errJson.error;
          } catch {
            // Keep default HTTP message
          }
          if (resp.status === 503 || resp.status === 429) {
            this.lastVoiceError =
              resp.status === 429
                ? 'Gemini TTS daily quota reached (429). Check Settings > Secrets for a billing-enabled API key or try again after quota resets.'
                : errMsg;
            if (resp.status === 503) {
              this.voiceApiDisabled = true;
            }
          }
          return { buffer: null, error: this.lastVoiceError || errMsg };
        }

        const json = (await resp.json()) as { audioBase64?: string };
        if (!json.audioBase64) {
          return { buffer: null, error: 'Empty audio payload.' };
        }
        const buf = decodeBase64ToArrayBuffer(json.audioBase64);
        this.rawCache.set(key, buf);
        this.lastVoiceError = null;
        return { buffer: buf };
      } catch {
        return { buffer: null, error: 'Network error reaching voice service.' };
      } finally {
        this.inFlightFetches.delete(key);
      }
    })();

    this.inFlightFetches.set(key, promise);
    return promise;
  }

  private async playGeminiVoice(
    cue: DialogueCue,
    nonce: number,
    callbacks?: VoicePlaybackCallbacks,
  ): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Ignore resume rejection
      }
    }

    if (ctx) {
      const { buffer, error } = await this.fetchAndDecodeCue(cue);
      if (this.muted || nonce !== this.activeCueNonce) return;

      if (buffer) {
        this.playProcessedAudioBuffer(ctx, buffer, cue, nonce, callbacks);
        return;
      }
      if (error) {
        callbacks?.onError?.(error);
      }
    }

    // Never fall back to robotic browser speechSynthesis; keep subtitles timed cleanly with SFX cues
    if (nonce === this.activeCueNonce) {
      callbacks?.onStarted?.(cue.id, cue.durationSec);
      globalThis.setTimeout(() => {
        if (nonce === this.activeCueNonce) {
          callbacks?.onEnded?.(cue.id);
        }
      }, Math.round(cue.durationSec * 1000));
    }
  }

  private playProcessedAudioBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    cue: DialogueCue,
    nonce: number,
    callbacks?: VoicePlaybackCallbacks,
  ): void {
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const masterGain = ctx.createGain();
      if (cue.speaker === 'warrior') {
        masterGain.gain.value = cue.delivery === 'tremble' ? 0.74 : 0.96;

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
        masterGain.gain.value = cue.isBanter ? 0.76 : 0.95;

        const bassBoost = ctx.createBiquadFilter();
        bassBoost.type = 'lowshelf';
        bassBoost.frequency.value = 125;
        bassBoost.gain.value = 5.5;

        const clarityPeak = ctx.createBiquadFilter();
        clarityPeak.type = 'peaking';
        clarityPeak.frequency.value = 2200;
        clarityPeak.Q.value = 1.1;
        clarityPeak.gain.value = 2.0;

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
        if (nonce === this.activeCueNonce) {
          callbacks?.onEnded?.(cue.id);
        }
      };

      this.activeSource = source;
      source.start(0);
      callbacks?.onStarted?.(cue.id, buffer.duration);
    } catch {
      callbacks?.onStarted?.(cue.id, cue.durationSec);
      globalThis.setTimeout(() => {
        if (nonce === this.activeCueNonce) callbacks?.onEnded?.(cue.id);
      }, Math.round(cue.durationSec * 1000));
    }
  }
}

export const cutsceneVoice = new CutsceneVoiceController();
