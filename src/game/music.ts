// Procedural Dark Fantasy Boss Battle Soundtrack Engine (100% Web Audio API)
// Zero external dependencies or API quotas. Uses a rock-solid lookahead 16th-note
// scheduler with seamless bar looping, dynamic intensity states, and voice ducking.

export type BossMusicMode = 'intro' | 'combat' | 'phase2' | 'last_dance' | 'ending';

const NOTE_FREQ: Record<string, number> = {
  D1: 36.71,
  Eb1: 38.89,
  E1: 41.2,
  F1: 43.65,
  G1: 49.0,
  Ab1: 51.91,
  A1: 55.0,
  Bb1: 58.27,
  B1: 61.74,
  C2: 65.41,
  Cs2: 69.3,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  Fs2: 92.5,
  G2: 98.0,
  Ab2: 103.83,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  Cs3: 138.59,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185.0,
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  Cs4: 277.18,
  D4: 293.66,
  Eb4: 311.13,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  Ab4: 415.3,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  Cs5: 554.37,
  D5: 587.33,
  Eb5: 622.25,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  Ab5: 830.61,
  A5: 880.0,
  Bb5: 932.33,
  C6: 1046.5,
  D6: 1174.66,
};

function freq(note: string): number {
  return NOTE_FREQ[note] ?? 146.83;
}

interface ChordBar {
  bass: string;
  brass: [string, string, string];
  pad: [string, string, string];
}

// 16-bar dark fantasy D minor / D Phrygian Dominant progression
// Bars 0-7: Aggressive combat groove
// Bars 8-9: Brief dramatic drop & tension swell
// Bars 10-15: Full-intensity heroic surge
const COMBAT_CHORDS: ChordBar[] = [
  // Bars 0-1: Dm
  { bass: 'D2', brass: ['D3', 'A3', 'F4'], pad: ['D2', 'A2', 'F3'] },
  { bass: 'D2', brass: ['D3', 'A3', 'F4'], pad: ['D2', 'A2', 'F3'] },
  // Bars 2-3: Bb -> C
  { bass: 'Bb1', brass: ['Bb2', 'F3', 'D4'], pad: ['Bb1', 'F2', 'D3'] },
  { bass: 'C2', brass: ['C3', 'G3', 'E4'], pad: ['C2', 'G2', 'E3'] },
  // Bars 4-5: Dm -> Eb (ominous Phrygian tension)
  { bass: 'D2', brass: ['D3', 'A3', 'F4'], pad: ['D2', 'A2', 'F3'] },
  { bass: 'Eb2', brass: ['Eb3', 'Bb3', 'G4'], pad: ['Eb2', 'Bb2', 'G3'] },
  // Bars 6-7: Gm -> A7 (sharp dominant turn)
  { bass: 'G1', brass: ['G2', 'D3', 'Bb3'], pad: ['G2', 'D3', 'Bb3'] },
  { bass: 'A1', brass: ['A2', 'E3', 'Cs4'], pad: ['A1', 'E2', 'Cs3'] },
  // Bars 8-9: Dramatic Drop & Tension Swell (Dm low drone -> A Phrygian swell)
  { bass: 'D2', brass: ['D3', 'A3', 'F4'], pad: ['D2', 'A2', 'D3'] },
  { bass: 'A1', brass: ['A2', 'E3', 'Cs4'], pad: ['A1', 'E2', 'Cs3'] },
  // Bars 10-11: Heroic Surge I (Dm -> F)
  { bass: 'D2', brass: ['D3', 'A3', 'F4'], pad: ['D2', 'A2', 'F3'] },
  { bass: 'F2', brass: ['F3', 'C4', 'A4'], pad: ['F2', 'C3', 'A3'] },
  // Bars 12-13: Heroic Surge II (Gm -> Bb)
  { bass: 'G1', brass: ['G2', 'D3', 'Bb3'], pad: ['G2', 'D3', 'Bb3'] },
  { bass: 'Bb1', brass: ['Bb2', 'F3', 'D4'], pad: ['Bb1', 'F2', 'D3'] },
  // Bars 14-15: Climax Cadence (Eb -> A)
  { bass: 'Eb2', brass: ['Eb3', 'Bb3', 'G4'], pad: ['Eb2', 'Bb2', 'G3'] },
  { bass: 'A1', brass: ['A2', 'E3', 'Cs4'], pad: ['A1', 'E2', 'Cs3'] },
];

// Subtle retro chiptune / synth-rock lead patterns per 2-bar phrase (32 16th steps)
const LEAD_A_1: (string | null)[] = [
  'D5', null, 'F5', null, 'E5', null, 'D5', null,
  'A4', null, null, 'Bb4', 'A4', null, 'G4', null,
  'F4', null, 'G4', null, 'A4', null, 'D5', null,
  'Cs5', null, 'D5', null, 'E5', null, 'A4', null,
];

const LEAD_A_2: (string | null)[] = [
  'Bb4', null, 'D5', null, 'F5', null, 'D5', null,
  'C5', null, 'E5', null, 'G5', null, 'E5', null,
  'D5', null, 'F5', null, 'E5', null, 'D5', null,
  'Cs5', null, 'A4', null, 'E5', null, 'Cs5', null,
];

const LEAD_A_3: (string | null)[] = [
  'D5', null, 'A4', 'D5', 'F5', null, 'E5', null,
  'Eb5', null, 'Bb4', 'Eb5', 'G5', null, 'F5', null,
  'D5', null, 'Bb4', null, 'G4', null, 'Bb4', null,
  'A4', null, 'Cs5', null, 'E5', null, 'A5', null,
];

// Heroic surge melody (Bars 10-15)
const LEAD_SURGE_1: (string | null)[] = [
  'D5', null, 'E5', null, 'F5', null, 'A5', null,
  'G5', null, 'F5', null, 'E5', null, 'D5', null,
  'F5', null, 'G5', null, 'A5', null, 'C6', null,
  'Bb5', null, 'A5', null, 'G5', null, 'F5', null,
];

const LEAD_SURGE_2: (string | null)[] = [
  'G5', null, 'D5', 'G5', 'Bb5', null, 'A5', null,
  'F5', null, 'D5', 'F5', 'Bb5', null, 'A5', null,
  'Eb5', null, 'G5', null, 'Bb5', null, 'G5', null,
  'A5', 'G5', 'F5', 'E5', 'Cs5', null, 'A4', null,
];

// Intro eerie plucked motif (16 steps)
const INTRO_MOTIF: (string | null)[] = [
  'D4', null, null, null, 'A3', null, 'Bb3', null,
  'A3', null, null, null, 'Eb4', null, 'D4', null,
];

class BossMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private reverbBus: GainNode | null = null;
  private bassDriveBus: WaveShaperNode | null = null;
  private bassFilterBus: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Sustained dark string ensemble nodes
  private stringOscs: OscillatorNode[] = [];
  private stringFilter: BiquadFilterNode | null = null;
  private stringGain: GainNode | null = null;

  // Scheduler state
  private running = false;
  private paused = false;
  private muted = false;
  private ducked = false;
  private mode: BossMusicMode = 'combat';
  private timerId: number | null = null;
  private nextStepTime = 0;
  private stepInBar = 0;
  private barIndex = 0;
  private buildupBarsLeft = 0;

  private ensureGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        const ctx = new AudioCtx();
        this.ctx = ctx;

        const master = ctx.createGain();
        master.gain.value = this.muted || this.paused ? 0 : 1;
        master.connect(ctx.destination);
        this.masterGain = master;

        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 10;
        comp.ratio.value = 4.5;
        comp.attack.value = 0.004;
        comp.release.value = 0.16;
        comp.connect(master);

        const musicGain = ctx.createGain();
        musicGain.gain.value = this.ducked ? 0.13 : 0.34;
        musicGain.connect(comp);
        this.musicGain = musicGain;

        const dry = ctx.createGain();
        dry.gain.value = 1;
        dry.connect(musicGain);
        this.dryBus = dry;

        // Dark fantasy hall delay / ambience bus
        const reverbInput = ctx.createGain();
        reverbInput.gain.value = 0.28;
        this.reverbBus = reverbInput;

        const delayL = ctx.createDelay(0.5);
        delayL.delayTime.value = 0.047;
        const delayR = ctx.createDelay(0.5);
        delayR.delayTime.value = 0.073;
        const fbL = ctx.createGain();
        fbL.gain.value = 0.34;
        const fbR = ctx.createGain();
        fbR.gain.value = 0.32;
        const dampL = ctx.createBiquadFilter();
        dampL.type = 'lowpass';
        dampL.frequency.value = 2200;
        const dampR = ctx.createBiquadFilter();
        dampR.type = 'lowpass';
        dampR.frequency.value = 1950;

        reverbInput.connect(delayL);
        reverbInput.connect(delayR);
        delayL.connect(dampL);
        delayR.connect(dampR);
        dampL.connect(fbL);
        dampR.connect(fbR);
        fbL.connect(delayR);
        fbR.connect(delayL);
        dampL.connect(musicGain);
        dampR.connect(musicGain);

        // Gritty saturated bass / electric undertone bus
        const drive = ctx.createWaveShaper();
        drive.curve = this.makeSaturationCurve(22);
        drive.oversample = '2x';
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 820;
        bassFilter.Q.value = 1.6;
        drive.connect(bassFilter);
        bassFilter.connect(dry);
        this.bassDriveBus = drive;
        this.bassFilterBus = bassFilter;

        this.initStringPad(ctx);
      }

      if (this.ctx && this.ctx.state === 'suspended' && !this.muted && !this.paused) {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private initStringPad(ctx: AudioContext): void {
    if (this.stringOscs.length > 0 || !this.dryBus || !this.reverbBus) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    const specs: Array<{ type: OscillatorType; detune: number; mult: number }> = [
      { type: 'sawtooth', detune: -9, mult: 1 },
      { type: 'sawtooth', detune: 9, mult: 1 },
      { type: 'sawtooth', detune: -4, mult: 1.5 },
      { type: 'triangle', detune: 0, mult: 0.5 },
    ];

    const oscs: OscillatorNode[] = [];
    for (const s of specs) {
      const osc = ctx.createOscillator();
      osc.type = s.type;
      osc.frequency.value = freq('D2') * s.mult;
      osc.detune.value = s.detune;
      osc.connect(filter);
      osc.start();
      oscs.push(osc);
    }

    this.stringFilter = filter;
    this.stringGain = gain;
    this.stringOscs = oscs;
  }

  private makeSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 18 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  public unlock(): void {
    this.ensureGraph();
  }

  public start(mode: BossMusicMode = 'combat'): void {
    const ctx = this.ensureGraph();
    if (!ctx) return;

    this.mode = mode;
    this.paused = false;
    this.barIndex = 0;
    this.stepInBar = 0;
    this.buildupBarsLeft = mode === 'combat' ? 2 : 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    this.updateMixGains(0.18);

    if (!this.running) {
      this.running = true;
      this.timerId = window.setInterval(() => {
        this.schedulerTick();
      }, 25);
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      if (this.ctx && this.stringGain) {
        const now = this.ctx.currentTime;
        this.stringGain.gain.cancelScheduledValues(now);
        this.stringGain.gain.setTargetAtTime(0.0001, now, 0.14);
      }
      this.updateMixGains(0.2);
    } catch {
      // Ignore Web Audio cleanup error
    }
  }

  public setIntensity(nextMode: BossMusicMode): void {
    if (this.mode === nextMode) return;
    const prevMode = this.mode;
    this.mode = nextMode;

    try {
      if (nextMode === 'combat' && prevMode === 'intro') {
        // Smoothly ignite straight into full groove after intro cutscene build
        this.buildupBarsLeft = 0;
        this.barIndex = 0;
        this.stepInBar = 0;
        if (this.ctx && this.ctx.state === 'running') {
          this.playCrash(this.ctx.currentTime + 0.02, 0.42);
        }
      } else if (nextMode === 'phase2' || nextMode === 'last_dance') {
        if (this.bassFilterBus && this.ctx) {
          this.bassFilterBus.frequency.setTargetAtTime(
            nextMode === 'last_dance' ? 1280 : 1040,
            this.ctx.currentTime,
            0.25,
          );
        }
        if (this.ctx && this.running && this.ctx.state === 'running') {
          this.playCrash(this.ctx.currentTime + 0.02, 0.45);
        }
      } else if (nextMode === 'ending') {
        if (this.ctx && this.stringFilter && this.stringGain) {
          const now = this.ctx.currentTime;
          this.stringFilter.frequency.setTargetAtTime(340, now, 0.3);
          this.stringGain.gain.setTargetAtTime(0.075, now, 0.25);
        }
      }
    } catch {
      // Ignore Web Audio scheduling errors on mode transitions
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      if (!muted && this.ctx && this.running && !this.paused) {
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => {});
        }
        this.nextStepTime = this.ctx.currentTime + 0.04;
      }
      this.updateMixGains(0.06);
    } catch {
      // Ignore Web Audio state errors
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    try {
      this.updateMixGains(0.08);
      if (!this.ctx) return;
      if (paused && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      } else if (!paused && !this.muted && this.running && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
        this.nextStepTime = this.ctx.currentTime + 0.04;
      }
    } catch {
      // Ignore Web Audio suspend/resume errors
    }
  }

  public setDucked(ducked: boolean): void {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    this.updateMixGains(0.22);
  }

  private updateMixGains(tc: number): void {
    if (!this.ctx || !this.masterGain || !this.musicGain) return;
    try {
      const now = this.ctx.currentTime;
      const masterTarget = this.muted || this.paused || !this.running ? 0.0001 : 1.0;
      const duckTarget = this.ducked ? 0.13 : this.mode === 'intro' ? 0.26 : 0.34;

      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(masterTarget, now, tc);

      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(duckTarget, now, tc);
    } catch {
      // Ignore gain automation errors
    }
  }

  private getStepDurationSec(): number {
    let bpm = 148;
    if (this.mode === 'intro') bpm = 108;
    else if (this.mode === 'phase2') bpm = 158;
    else if (this.mode === 'last_dance') bpm = 166;
    else if (this.mode === 'ending') bpm = 96;
    return 60 / bpm / 4; // 16th note duration
  }

  private schedulerTick(): void {
    if (!this.running || this.paused || this.muted) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    try {
      const scheduleAhead = 0.13;
      const stepDur = this.getStepDurationSec();

      // Prevent catch-up bursts after tab switch
      if (!Number.isFinite(this.nextStepTime) || this.nextStepTime < ctx.currentTime - 0.25) {
        this.nextStepTime = ctx.currentTime + 0.03;
      }

      let steps = 0;
      while (this.nextStepTime < ctx.currentTime + scheduleAhead && steps < 8) {
        this.scheduleStep(this.nextStepTime, stepDur);
        this.nextStepTime += stepDur;
        this.advanceStep();
        steps++;
      }
    } catch {
      // Never let Web Audio scheduler crash the interval
    }
  }

  private advanceStep(): void {
    this.stepInBar += 1;
    if (this.stepInBar >= 16) {
      this.stepInBar = 0;
      if (this.buildupBarsLeft > 0) {
        this.buildupBarsLeft -= 1;
      } else {
        const loopLen = this.mode === 'intro' ? 4 : COMBAT_CHORDS.length;
        this.barIndex = (this.barIndex + 1) % loopLen;
      }
    }
  }

  private scheduleStep(time: number, stepDur: number): void {
    if (this.mode === 'ending') {
      if (this.stepInBar === 0) {
        this.updateStrings(time, 'D2', 300, 0.07);
      }
      return;
    }

    if (this.mode === 'intro') {
      this.scheduleIntroStep(time, stepDur);
      return;
    }

    if (this.buildupBarsLeft > 0) {
      this.scheduleIgnitionBuildStep(time, stepDur);
      return;
    }

    this.scheduleCombatStep(time, stepDur);
  }

  // Suspenseful heartbeat build-up for the opening cutscene
  private scheduleIntroStep(time: number, stepDur: number): void {
    const step = this.stepInBar;
    const bar = this.barIndex;

    // Eerie dark string progression sweeping gently upward over 4 bars
    if (step === 0) {
      const roots = ['D2', 'D2', 'Eb2', 'A1'];
      const cutoffs = [290, 360, 480, 620];
      this.updateStrings(time, roots[bar % 4], cutoffs[bar % 4], 0.12);
    }

    // Heartbeat double-thump pulse
    if (step === 0 || step === 3 || step === 8 || step === 11) {
      const accent = step === 0 || step === 8 ? 0.58 : 0.36;
      this.playKick(time, accent, 54);
    }

    // Cautious metallic ticking
    if (step % 4 === 2) {
      this.playHiHat(time, 0.1, false);
    }

    // Eerie plucked harp / chiptune motif
    const note = INTRO_MOTIF[step];
    if (note) {
      this.playIntroPluck(time, freq(note), stepDur * 2.2);
    }

    // Distant war-drum anticipation on bar 3
    if (bar === 3 && (step === 12 || step === 14 || step === 15)) {
      this.playWarTom(time, step === 15 ? 0.42 : 0.28, step === 15 ? 92 : 76);
    }
  }

  // Brief 2-bar tense ignition build before exploding into the main loop
  private scheduleIgnitionBuildStep(time: number, stepDur: number): void {
    const step = this.stepInBar;
    const isFinalBuildBar = this.buildupBarsLeft === 1;

    if (step === 0) {
      this.updateStrings(time, isFinalBuildBar ? 'A1' : 'D2', isFinalBuildBar ? 1900 : 880, 0.16);
      this.playBrassStab(time, isFinalBuildBar ? ['A2', 'E3', 'Cs4'] : ['D3', 'A3', 'F4'], stepDur * 6, 0.24);
    }

    // Heartbeat -> accelerating pulse
    if (step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14) {
      this.playKick(time, 0.72, 62);
    }

    // Pulsing low bass builds tension
    if (step % 2 === 0) {
      this.playSynthBass(time, freq(isFinalBuildBar ? 'A1' : 'D2'), stepDur * 1.5, 0.32);
    }

    // Accelerating snare & war-drum build into drop
    if (isFinalBuildBar) {
      if (step >= 8 || step % 4 === 0) {
        this.playSnare(time, 0.16 + step * 0.025);
      }
      if (step === 12 || step === 14) {
        this.playWarTom(time, 0.46, 88);
      }
    } else if (step === 4 || step === 12) {
      this.playWarTom(time, 0.34, 78);
    }
  }

  private scheduleCombatStep(time: number, stepDur: number): void {
    const bar = this.barIndex;
    const step = this.stepInBar;
    const chord = COMBAT_CHORDS[bar];
    const isDropBar = bar === 8 || bar === 9;
    const isSurge = bar >= 10;
    const highIntensity = this.mode === 'phase2' || this.mode === 'last_dance';

    // Update sustained dark strings & sweeps at bar boundaries
    if (step === 0) {
      if (bar === 0 || bar === 10) {
        this.playCrash(time, isSurge ? 0.5 : 0.38);
      }
      if (bar === 8) {
        // Dramatic drop: clamp string filter dark then slowly bloom
        this.updateStrings(time, chord.pad[0], 310, 0.13);
      } else if (bar === 9) {
        // Dramatic swell upward before the heroic surge
        this.updateStrings(time, chord.pad[0], 2500, 0.2);
      } else {
        const cutoff = isSurge ? 1650 : highIntensity ? 1350 : 980;
        this.updateStrings(time, chord.pad[0], cutoff, isSurge ? 0.19 : 0.15);
      }
    }

    // 1. DRAMATIC DROP & TENSION SWELL (Bars 8-9)
    if (isDropBar) {
      // Heartbeat pulse + ominous war toms
      if (step === 0 || step === 3 || step === 8 || step === 11) {
        this.playKick(time, step === 0 ? 0.82 : 0.5, 58);
      }
      if (step === 0 || step === 6 || (bar === 8 && step === 12)) {
        this.playWarTom(time, 0.44, step === 0 ? 70 : 86);
      }
      // Deep pulsing bass pedal
      if (step % 4 === 0 || (bar === 9 && step % 2 === 0)) {
        this.playSynthBass(time, freq(chord.bass), stepDur * 2.2, bar === 9 ? 0.36 : 0.28);
      }
      // Dramatic brass swell hit on Bar 9
      if (bar === 9 && step === 0) {
        this.playBrassStab(time, chord.brass, stepDur * 10, 0.28);
      }
      // Accelerating 16th snare roll on second half of Bar 9 surging back to full power
      if (bar === 9 && step >= 8) {
        const ramp = (step - 7) / 8;
        this.playSnare(time, 0.18 + ramp * 0.48);
        if (step >= 12) {
          this.playWarTom(time, 0.3 + ramp * 0.22, 82 + step * 2);
        }
      }
      return;
    }

    // 2. DRIVING PUNCHY PERCUSSION & WAR DRUMS
    const kickHit =
      step === 0 ||
      step === 3 ||
      step === 6 ||
      step === 8 ||
      step === 10 ||
      step === 14 ||
      ((highIntensity || isSurge) && (step === 2 || step === 11));
    if (kickHit) {
      const vel = step === 0 || step === 8 ? 0.92 : 0.68;
      this.playKick(time, vel, step === 0 ? 64 : 58);
    }

    const snareHit =
      step === 4 ||
      step === 12 ||
      (bar % 2 === 1 && (step === 14 || step === 15)) ||
      (bar === 7 && step >= 12);
    if (snareHit) {
      const vel = step === 4 || step === 12 ? 0.68 : 0.38;
      this.playSnare(time, vel);
    }

    // War drums on heroic syncopations
    if (step === 0 || step === 6 || (isSurge && (step === 10 || step === 14))) {
      this.playWarTom(time, step === 0 ? 0.48 : 0.35, step === 6 ? 94 : 74);
    }

    // Urgent crisp hi-hats
    if (step % 2 === 0 || highIntensity || isSurge) {
      const open = step === 14;
      const hatVol = step % 4 === 2 ? 0.16 : step % 2 === 0 ? 0.1 : 0.06;
      this.playHiHat(time, hatVol, open);
    }

    // 3. PULSING LOW SYNTH BASS & GRITTY ELECTRIC UNDERTONES
    const bassFreq = freq(chord.bass);
    const octaveStep = step % 4 === 2 || step === 15;
    const playBass = step % 2 === 0 || highIntensity || isSurge || step === 3 || step === 11;
    if (playBass) {
      const f = octaveStep ? bassFreq * 2 : bassFreq;
      const accent = step % 4 === 0 ? 0.42 : 0.28;
      this.playSynthBass(time, f, stepDur * 0.9, accent);
    }

    // 4. SHARP DRAMATIC BRASS STABS
    const brassHit =
      step === 0 ||
      step === 6 ||
      step === 10 ||
      (bar % 2 === 1 && step === 14);
    if (brassHit) {
      const stabLen = step === 0 ? stepDur * 3.8 : stepDur * 2.1;
      const stabVol = step === 0 ? 0.3 : 0.22;
      this.playBrassStab(time, chord.brass, stabLen, stabVol);
    }

    // 5. SUBTLE RETRO CHIPTUNE / SYNTH-ROCK ACCENTS
    const phraseStep = (bar % 2) * 16 + step;
    let leadNote: string | null = null;
    if (bar < 2) leadNote = LEAD_A_1[phraseStep];
    else if (bar < 4) leadNote = LEAD_A_2[phraseStep];
    else if (bar < 8) leadNote = LEAD_A_3[phraseStep];
    else if (bar < 12) leadNote = LEAD_SURGE_1[phraseStep];
    else leadNote = LEAD_SURGE_2[phraseStep];

    if (leadNote) {
      const baseF = freq(leadNote);
      const leadF = this.mode === 'last_dance' ? baseF * 2 : baseF;
      this.playLeadNote(time, leadF, stepDur * 1.75, isSurge ? 0.18 : 0.14);
    } else if ((highIntensity || isSurge) && step % 2 === 1) {
      // Subtle rapid retro arpeggio shimmer underneath
      const arpNote = chord.brass[step % 3];
      this.playLeadNote(time, freq(arpNote) * 2, stepDur * 0.65, 0.055);
    }
  }

  // --- SYNTHESIS VOICES ---

  private updateStrings(time: number, rootNote: string, cutoffHz: number, level: number): void {
    if (!this.stringFilter || !this.stringGain || this.stringOscs.length < 4) return;
    const base = freq(rootNote);
    const mults = [1, 1, 1.5, 0.5];
    for (let i = 0; i < 4; i++) {
      this.stringOscs[i].frequency.setTargetAtTime(base * mults[i], time, 0.06);
    }
    this.stringFilter.frequency.setTargetAtTime(cutoffHz, time, 0.42);
    this.stringGain.gain.setTargetAtTime(level, time, 0.18);
  }

  private playKick(time: number, velocity: number, baseEndHz: number): void {
    if (!this.ctx || !this.dryBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(36, baseEndHz * 0.72), time + 0.085);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.65 * velocity, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

    // Punchy beater click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(920, time);
    click.frequency.exponentialRampToValueAtTime(140, time + 0.018);
    clickGain.gain.setValueAtTime(0.22 * velocity, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.022);

    osc.connect(gain);
    gain.connect(this.dryBus);
    click.connect(clickGain);
    clickGain.connect(this.dryBus);

    osc.start(time);
    osc.stop(time + 0.21);
    click.start(time);
    click.stop(time + 0.025);
  }

  private playSnare(time: number, velocity: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, time);
    bp.Q.value = 0.9;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.42 * velocity, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.dryBus);
    nGain.connect(this.reverbBus);

    const body = ctx.createOscillator();
    const bGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, time);
    body.frequency.exponentialRampToValueAtTime(108, time + 0.06);
    bGain.gain.setValueAtTime(0.32 * velocity, time);
    bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    body.connect(bGain);
    bGain.connect(this.dryBus);

    noise.start(time);
    noise.stop(time + 0.15);
    body.start(time);
    body.stop(time + 0.1);
  }

  private playWarTom(time: number, velocity: number, pitchHz: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitchHz * 1.45, time);
    osc.frequency.exponentialRampToValueAtTime(pitchHz * 0.65, time + 0.22);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.55 * velocity, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playHiHat(time: number, velocity: number, open: boolean): void {
    if (!this.ctx || !this.dryBus) return;
    const ctx = this.ctx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);

    const dur = open ? 0.14 : 0.045;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.dryBus);

    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  private playCrash(time: number, velocity: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3800, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.32 * velocity, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.95);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    noise.start(time);
    noise.stop(time + 1.0);
  }

  private playSynthBass(time: number, hz: number, dur: number, velocity: number): void {
    if (!this.ctx || !this.bassDriveBus || !this.dryBus) return;
    const ctx = this.ctx;

    // Gritty electric/sawtooth bass undertone through saturation
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(hz, time);

    // Clean sub weight underneath
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(hz, time);

    const driveGain = ctx.createGain();
    driveGain.gain.setValueAtTime(0.001, time);
    driveGain.gain.linearRampToValueAtTime(0.32 * velocity, time + 0.008);
    driveGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, time);
    subGain.gain.linearRampToValueAtTime(0.45 * velocity, time + 0.006);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    saw.connect(driveGain);
    driveGain.connect(this.bassDriveBus);

    sub.connect(subGain);
    subGain.connect(this.dryBus);

    saw.start(time);
    saw.stop(time + dur + 0.02);
    sub.start(time);
    sub.stop(time + dur + 0.02);
  }

  private playBrassStab(time: number, notes: [string, string, string], dur: number, velocity: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, time);
    filter.frequency.exponentialRampToValueAtTime(2400, time + 0.035);
    filter.frequency.exponentialRampToValueAtTime(760, time + dur);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(velocity, time + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const targetHz = freq(notes[i]);
      osc.frequency.setValueAtTime(targetHz * 0.985, time);
      osc.frequency.linearRampToValueAtTime(targetHz, time + 0.028);
      osc.detune.value = (i - 1) * 7;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.03);
    }
  }

  private playLeadNote(time: number, hz: number, dur: number, velocity: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    // Subtle retro chiptune / synth-rock square + saw blend
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.setValueAtTime(hz, time);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(hz, time);
    saw.detune.value = 8;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.exponentialRampToValueAtTime(1400, time + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(velocity, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    sq.connect(filter);
    saw.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    sq.start(time);
    sq.stop(time + dur + 0.02);
    saw.start(time);
    saw.stop(time + dur + 0.02);
  }

  private playIntroPluck(time: number, hz: number, dur: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbBus) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hz, time);

    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.setValueAtTime(hz * 2, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.frequency.exponentialRampToValueAtTime(360, time + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    sq.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbBus);

    osc.start(time);
    osc.stop(time + dur + 0.02);
    sq.start(time);
    sq.stop(time + dur + 0.02);
  }
}

export const bossMusic = new BossMusicEngine();
