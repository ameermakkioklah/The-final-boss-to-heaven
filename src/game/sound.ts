import type { WeaponType } from './types';

class RealisticBattleAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private distCurve: Float32Array<ArrayBuffer> | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Rich pink-brown noise blend for realistic combustion, wind, and heavy impacts
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.42) * 0.65));
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private getDistortionCurve(): Float32Array<ArrayBuffer> {
    if (this.distCurve) return this.distCurve;
    const samples = 256;
    const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const k = 18;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    this.distCurve = curve;
    return curve;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playUiTick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.035);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Distinct authentic weapon swing audio
  public playComboSlash(
    comboStep: number,
    isCrit = false,
    weapon: WeaponType = 'broadsword'
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const playAirWhoosh = (
      startOffset: number,
      type: BiquadFilterType,
      fStart: number,
      fEnd: number,
      q: number,
      vol: number,
      dur: number
    ) => {
      const t0 = now + startOffset;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(fStart * jitter, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd * jitter), t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + dur * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t0, Math.random() * 0.5, dur + 0.02);
    };

    const playSteelRing = (baseFreq: number, dur: number, vol: number) => {
      [1, 1.54, 2.38].forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * ratio * jitter, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * ratio * 0.88, now + dur);
        g.gain.setValueAtTime(vol / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.01);
      });
    };

    if (weapon === 'daggers') {
      // Rapid twin-blade double slash
      playAirWhoosh(0, 'highpass', 2200, 3800, 1.5, 0.12, 0.065);
      playAirWhoosh(0.04, 'highpass', 2500, 4200, 1.8, 0.11, 0.065);
      playSteelRing(1950, 0.08, 0.032);
    } else if (weapon === 'katana') {
      // Razor steel sing + slicing air whistle
      playAirWhoosh(0, 'bandpass', 2600, 1150, 3.2, 0.14, 0.105);
      playSteelRing(1560, 0.14, 0.048);
    } else if (weapon === 'spear') {
      // Crisp piercing thrust whistle
      playAirWhoosh(0, 'bandpass', 1500, 2700, 2.8, 0.13, 0.095);
    } else if (weapon === 'axe') {
      // Heavy, deep air cleave
      playAirWhoosh(0, 'bandpass', 580, 180, 1.1, 0.18, 0.17);
    } else if (weapon === 'mace') {
      // Heavy blunt momentum swoosh
      playAirWhoosh(0, 'lowpass', 480, 130, 0.9, 0.19, 0.18);
    } else {
      // Broadsword wide steel arc
      const f = comboStep === 3 ? 1020 : 1320;
      playAirWhoosh(0, 'bandpass', f, 390, 1.8, 0.14, 0.125);
      playSteelRing(1040, 0.12, 0.038);
    }

    if (isCrit) {
      playSteelRing(1820, 0.15, 0.045);
    }
  }

  // Distinct authentic weapon hit impact sounds
  public playWeaponHit(weapon: WeaponType, isCrit = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const critMult = isCrit ? 1.25 : 1.0;

    // Sub-weight impact thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    const isHeavy = weapon === 'axe' || weapon === 'mace';
    thud.type = weapon === 'mace' ? 'triangle' : 'sine';
    const startFreq =
      weapon === 'mace' ? 125 : weapon === 'axe' ? 160 : weapon === 'daggers' ? 245 : 195;
    const dur = weapon === 'mace' ? 0.22 : weapon === 'axe' ? 0.19 : 0.12;
    thud.frequency.setValueAtTime(startFreq * jitter, now);
    thud.frequency.exponentialRampToValueAtTime(34, now + dur);
    thudGain.gain.setValueAtTime(Math.min(0.28, (isHeavy ? 0.21 : 0.14) * critMult), now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.01);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + dur + 0.02);

    const makeTransient = (
      offset: number,
      type: BiquadFilterType,
      freq: number,
      q: number,
      vol: number,
      tDur: number
    ) => {
      const t0 = now + offset;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.Q.value = q;
      flt.frequency.setValueAtTime(freq * jitter, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.26, vol * critMult), t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + tDur);
      src.connect(flt);
      flt.connect(g);
      g.connect(ctx.destination);
      src.start(t0, Math.random() * 0.4, tDur + 0.02);
    };

    if (weapon === 'broadsword' || weapon === 'katana') {
      // Sharp steel slice + metallic armor ring
      makeTransient(0, 'highpass', weapon === 'katana' ? 2100 : 1500, 1.0, 0.16, 0.085);
      const ring = ctx.createOscillator();
      const rGain = ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime((weapon === 'katana' ? 1980 : 1320) * jitter, now);
      ring.frequency.exponentialRampToValueAtTime(840, now + 0.16);
      rGain.gain.setValueAtTime(0.055 * critMult, now);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      ring.connect(rGain);
      rGain.connect(ctx.destination);
      ring.start(now);
      ring.stop(now + 0.18);
    } else if (weapon === 'daggers') {
      // Rapid twin-blade slices
      makeTransient(0, 'highpass', 2300, 1.2, 0.14, 0.06);
      makeTransient(0.038, 'highpass', 2700, 1.4, 0.12, 0.06);
    } else if (weapon === 'spear') {
      // Crisp piercing snap through scale armor
      makeTransient(0, 'bandpass', 1280, 3.2, 0.18, 0.075);
      makeTransient(0.015, 'highpass', 2400, 1.0, 0.09, 0.05);
    } else if (weapon === 'axe') {
      // Heavy crunching cleave
      makeTransient(0, 'bandpass', 720, 1.1, 0.21, 0.12);
      makeTransient(0.02, 'lowpass', 520, 0.8, 0.16, 0.14);
    } else if (weapon === 'mace') {
      // Deep blunt bone-crushing thud + iron armor reverberation
      makeTransient(0, 'lowpass', 620, 0.7, 0.24, 0.15);
      const iron = ctx.createOscillator();
      const iGain = ctx.createGain();
      iron.type = 'triangle';
      iron.frequency.setValueAtTime(360 * jitter, now);
      iron.frequency.exponentialRampToValueAtTime(190, now + 0.2);
      iGain.gain.setValueAtTime(0.11 * critMult, now);
      iGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      iron.connect(iGain);
      iGain.connect(ctx.destination);
      iron.start(now);
      iron.stop(now + 0.22);
    }
  }

  public playHitImpact(heavy = false): void {
    this.playWeaponHit(heavy ? 'mace' : 'broadsword', heavy);
  }

  public playParryClang(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [1140, 1740, 2560, 3420];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.93, now + 0.26);
      gain.gain.setValueAtTime(0.09 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    });
  }

  public playDiveSlam(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.26);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(750, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.16, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    src.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    src.start(now, 0, 0.22);
  }

  public playHealChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.085, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  public playDropSpawn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [784, 1174].forEach((f, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  public playWeaponPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((f, idx) => {
      const start = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.075, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  public playSuperSkillPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 987.77, 1318.51].forEach((f, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.095, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playThunderStrike(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 0.34);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now, 0, 0.36);
  }

  // Fierce, guttural beast snarl with saturated vocal cord modulation
  public playDragonSnarl(enraged = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = enraged ? 0.44 : 0.3;

    const cord = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const formant = ctx.createBiquadFilter();
    const mainGain = ctx.createGain();

    cord.type = 'sawtooth';
    cord.frequency.setValueAtTime(enraged ? 118 : 92, now);
    cord.frequency.exponentialRampToValueAtTime(enraged ? 58 : 50, now + dur);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(enraged ? 59 : 46, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + dur);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(enraged ? 38 : 28, now);
    lfoGain.gain.setValueAtTime(26, now);
    lfo.connect(lfoGain);
    lfoGain.connect(cord.frequency);

    shaper.curve = this.getDistortionCurve();
    formant.type = 'bandpass';
    formant.Q.value = 1.6;
    formant.frequency.setValueAtTime(enraged ? 480 : 360, now);
    formant.frequency.linearRampToValueAtTime(enraged ? 280 : 210, now + dur);

    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(enraged ? 0.19 : 0.13, now + 0.045);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    cord.connect(shaper);
    sub.connect(shaper);
    shaper.connect(formant);
    formant.connect(mainGain);
    mainGain.connect(ctx.destination);

    cord.start(now);
    sub.start(now);
    lfo.start(now);
    cord.stop(now + dur + 0.02);
    sub.stop(now + dur + 0.02);
    lfo.stop(now + dur + 0.02);
  }

  // Piercing dragon screech when taking burst/critical hits
  public playDragonScreech(enraged = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = enraged ? 0.36 : 0.26;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(enraged ? 520 : 410, now);
    osc.frequency.exponentialRampToValueAtTime(enraged ? 210 : 175, now + dur);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(42, now);
    lfoGain.gain.setValueAtTime(35, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    shaper.curve = this.getDistortionCurve();
    bp.type = 'bandpass';
    bp.Q.value = 2.0;
    bp.frequency.setValueAtTime(enraged ? 1150 : 920, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(enraged ? 0.14 : 0.1, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(shaper);
    shaper.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + dur + 0.02);
    lfo.stop(now + dur + 0.02);
  }

  // Death fake-out collapse groan before erupting into Phase 2
  public playDeathFakeoutCollapse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.65);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Pressurized real-flame combustion + roaring whoosh & crackle (louder & heavier in Phase 2)
  public playRealisticFireBreath(enraged = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = enraged ? 0.92 : 0.52;
    const noiseBuf = this.getNoiseBuffer(ctx);

    // Layer 1: Low-end combustion roar
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = noiseBuf;
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.setValueAtTime(enraged ? 340 : 240, now);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(enraged ? 0.28 : 0.16, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    rumbleSrc.connect(rumbleLp);
    rumbleLp.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleSrc.start(now, 0.1, dur + 0.05);

    // Layer 2: Pressurized inferno mid-whoosh
    const flameSrc = ctx.createBufferSource();
    flameSrc.buffer = noiseBuf;
    const flameFilter = ctx.createBiquadFilter();
    flameFilter.type = 'bandpass';
    flameFilter.Q.value = 0.85;
    flameFilter.frequency.setValueAtTime(enraged ? 480 : 380, now);
    flameFilter.frequency.exponentialRampToValueAtTime(enraged ? 1320 : 880, now + dur * 0.25);
    flameFilter.frequency.exponentialRampToValueAtTime(260, now + dur);

    const flameGain = ctx.createGain();
    flameGain.gain.setValueAtTime(0.001, now);
    flameGain.gain.linearRampToValueAtTime(enraged ? 0.26 : 0.17, now + 0.07);
    flameGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    flameSrc.connect(flameFilter);
    flameFilter.connect(flameGain);
    flameGain.connect(ctx.destination);
    flameSrc.start(now, Math.random() * 0.25, dur + 0.05);

    // Layer 3: Intense ember crackle & hiss
    const sizzleSrc = ctx.createBufferSource();
    sizzleSrc.buffer = noiseBuf;
    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'highpass';
    sizzleFilter.frequency.setValueAtTime(enraged ? 2100 : 2500, now);
    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.001, now);
    sizzleGain.gain.linearRampToValueAtTime(enraged ? 0.14 : 0.075, now + 0.06);
    sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.94);
    sizzleSrc.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(ctx.destination);
    sizzleSrc.start(now, 0.35, dur + 0.04);

    // Layer 4: Throat growl under the flame blast
    this.playDragonSnarl(enraged);
  }

  public playWyvernTelegraph(kind: 'crystal' | 'tail' | 'swoop' | 'blink', enraged = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (kind === 'swoop' || kind === 'tail') {
      this.playDragonSnarl(enraged);
    } else if (kind === 'crystal' && enraged) {
      this.playDragonScreech(true);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (kind === 'crystal') {
      osc.type = enraged ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(enraged ? 340 : 480, now);
      osc.frequency.exponentialRampToValueAtTime(enraged ? 1360 : 1220, now + 0.22);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else if (kind === 'tail') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    } else if (kind === 'blink') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playWingGust(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + 0.24);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now, 0.1, 0.28);
  }

  // Dramatic Infernal Phase 2 Awakening Roar (multi-layered beast roar + volcanic detonation)
  public playPhaseTwoRoar(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 1.05;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const sub = ctx.createOscillator();
    const roar = ctx.createOscillator();
    const screech = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.linearRampToValueAtTime(145, now + 0.2);
    sub.frequency.exponentialRampToValueAtTime(42, now + dur);

    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(210, now);
    roar.frequency.linearRampToValueAtTime(340, now + 0.18);
    roar.frequency.exponentialRampToValueAtTime(84, now + dur);

    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(480, now + 0.04);
    screech.frequency.exponentialRampToValueAtTime(190, now + dur * 0.85);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(34, now);
    lfoGain.gain.setValueAtTime(30, now);
    lfo.connect(lfoGain);
    lfoGain.connect(roar.frequency);

    shaper.curve = this.getDistortionCurve();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500, now);
    lp.frequency.exponentialRampToValueAtTime(420, now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    sub.connect(shaper);
    roar.connect(shaper);
    screech.connect(shaper);
    shaper.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    // Volcanic inferno air detonation
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = noiseBuf;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(640, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    nSrc.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);

    sub.start(now);
    roar.start(now);
    screech.start(now + 0.04);
    lfo.start(now);
    nSrc.start(now, 0, dur);
    sub.stop(now + dur + 0.02);
    roar.stop(now + dur + 0.02);
    screech.stop(now + dur + 0.02);
    lfo.stop(now + dur + 0.02);
  }

  // Heavy earth-shaking body crash when the dragon collapses onto the arena ground
  public playGroundCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(105, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.36);
    sGain.gain.setValueAtTime(0.28, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    sub.connect(sGain);
    sGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.4);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.24, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    src.start(now, 0, 0.34);
  }

  // Massive fiery shockwave detonation as the Infernal Phase 2 Dragon awakens
  public playInfernalExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.95;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140, now);
    boom.frequency.exponentialRampToValueAtTime(26, now + 0.55);
    boomGain.gain.setValueAtTime(0.32, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(now);
    boom.stop(now + 0.6);

    const blastSrc = ctx.createBufferSource();
    blastSrc.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(1900, now);
    bp.frequency.exponentialRampToValueAtTime(220, now + dur);
    const bGain = ctx.createGain();
    bGain.gain.setValueAtTime(0.3, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    blastSrc.connect(bp);
    bp.connect(bGain);
    bGain.connect(ctx.destination);
    blastSrc.start(now, 0.05, dur + 0.05);

    const crackleSrc = ctx.createBufferSource();
    crackleSrc.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, now);
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.16, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    crackleSrc.connect(hp);
    hp.connect(cGain);
    cGain.connect(ctx.destination);
    crackleSrc.start(now, 0.2, 0.7);
  }

  public playEmptyClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playWarriorAwakening(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);

    // Rising solar chord + blazing flame surge
    [293.66, 440, 587.33, 880].forEach((f, idx) => {
      const start = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, start + 0.55);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.68);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(340, now);
    bp.frequency.exponentialRampToValueAtTime(1750, now + 0.45);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    src.connect(bp);
    bp.connect(nGain);
    nGain.connect(ctx.destination);
    src.start(now, 0.1, 0.9);
  }

  public playDragonFuriousRoar(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 1.25;
    const noiseBuf = this.getNoiseBuffer(ctx);

    const sub = ctx.createOscillator();
    const roar = ctx.createOscillator();
    const screech = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(84, now);
    sub.frequency.linearRampToValueAtTime(160, now + 0.22);
    sub.frequency.exponentialRampToValueAtTime(36, now + dur);

    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(240, now);
    roar.frequency.linearRampToValueAtTime(420, now + 0.2);
    roar.frequency.exponentialRampToValueAtTime(92, now + dur);

    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(640, now + 0.05);
    screech.frequency.exponentialRampToValueAtTime(240, now + dur * 0.9);

    shaper.curve = this.getDistortionCurve();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2100, now);
    lp.frequency.exponentialRampToValueAtTime(520, now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    sub.connect(shaper);
    roar.connect(shaper);
    screech.connect(shaper);
    shaper.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    const nSrc = ctx.createBufferSource();
    nSrc.buffer = noiseBuf;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(820, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    nSrc.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);

    sub.start(now);
    roar.start(now);
    screech.start(now + 0.05);
    nSrc.start(now, 0, dur);
    sub.stop(now + dur + 0.02);
    roar.stop(now + dur + 0.02);
    screech.stop(now + dur + 0.02);
  }

  public playFlamePillarErupt(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(260, now);
    bp.frequency.exponentialRampToValueAtTime(1100, now + 0.14);
    bp.frequency.exponentialRampToValueAtTime(240, now + 0.42);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now, 0.15, 0.46);
  }

  public playOrbDetonate(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // 3-second rising volcanic & heroic harmonic charge for "THE LAST DANCE" standoff
  public playLastDanceCharge(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 2.95;
    const noiseBuf = this.getNoiseBuffer(ctx);

    // Rising sub-bass rumble & heroic brassy fifth
    [55, 82.41, 110].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.48, now + dur);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(160, now);
      lp.frequency.exponentialRampToValueAtTime(980, now + dur);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.14 : 0.07, now + 0.6);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.2 : 0.11, now + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    });

    // Swirling wind/firestorm tension bed
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(220, now);
    bp.frequency.exponentialRampToValueAtTime(1650, now + dur);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.18, now + 0.8);
    nGain.gain.linearRampToValueAtTime(0.24, now + dur - 0.12);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(bp);
    bp.connect(nGain);
    nGain.connect(ctx.destination);
    src.start(now, 0, dur + 0.05);
    src.stop(now + dur + 0.05);
  }

  // Deep, heavy, gravelly masculine warrior voice booming: "The Last Dance!"
  // Crafted with low glottal pulse + sub-chest resonance + vocal-fry rasp + parallel F1/F2/F3 formants + arena reverb
  public playLastDanceVoice(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const totalDur = 1.85;

    // Master bus + cathedral reverb taps
    const dryBus = ctx.createGain();
    dryBus.gain.value = 0.92;
    const wetBus = ctx.createGain();
    wetBus.gain.value = 0.42;

    const reverbLp = ctx.createBiquadFilter();
    reverbLp.type = 'lowpass';
    reverbLp.frequency.value = 1280;

    dryBus.connect(ctx.destination);
    wetBus.connect(reverbLp);
    reverbLp.connect(ctx.destination);

    [0.038, 0.071, 0.118].forEach((delaySec, idx) => {
      const del = ctx.createDelay(0.25);
      del.delayTime.value = delaySec;
      const tapGain = ctx.createGain();
      tapGain.gain.value = 0.42 / (idx + 1);
      dryBus.connect(del);
      del.connect(tapGain);
      tapGain.connect(wetBus);
    });

    // Glottal source (deep ~78-94Hz baritone-bass) + sub-octave chest weight + vocal fry rasp
    const voiceCore = ctx.createOscillator();
    voiceCore.type = 'sawtooth';
    const voiceWarm = ctx.createOscillator();
    voiceWarm.type = 'sawtooth';
    const subChest = ctx.createOscillator();
    subChest.type = 'triangle';

    // Gravelly vocal-cord LFO (subtle 29Hz rasp on pitch + saturation)
    const gravelLfo = ctx.createOscillator();
    gravelLfo.type = 'sine';
    gravelLfo.frequency.setValueAtTime(29, now);
    const gravelDepth = ctx.createGain();
    gravelDepth.gain.setValueAtTime(4.2, now);
    gravelLfo.connect(gravelDepth);
    gravelDepth.connect(voiceCore.frequency);

    // Pitch contour for: "The ... Laaaast ... Daaaance!"
    voiceCore.frequency.setValueAtTime(78, now);
    voiceCore.frequency.linearRampToValueAtTime(84, now + 0.14);
    voiceCore.frequency.setValueAtTime(88, now + 0.22);
    voiceCore.frequency.linearRampToValueAtTime(76, now + 0.56);
    voiceCore.frequency.setValueAtTime(94, now + 0.72);
    voiceCore.frequency.exponentialRampToValueAtTime(68, now + 1.38);

    voiceWarm.frequency.setValueAtTime(78 * 0.994, now);
    voiceWarm.frequency.linearRampToValueAtTime(84 * 0.994, now + 0.14);
    voiceWarm.frequency.setValueAtTime(88 * 0.994, now + 0.22);
    voiceWarm.frequency.linearRampToValueAtTime(76 * 0.994, now + 0.56);
    voiceWarm.frequency.setValueAtTime(94 * 0.994, now + 0.72);
    voiceWarm.frequency.exponentialRampToValueAtTime(68 * 0.994, now + 1.38);

    subChest.frequency.setValueAtTime(39, now);
    subChest.frequency.setValueAtTime(44, now + 0.22);
    subChest.frequency.setValueAtTime(47, now + 0.72);
    subChest.frequency.exponentialRampToValueAtTime(34, now + 1.38);

    // Subtle waveshaper grit on vocal tract for authentic rugged warrior texture
    const raspShaper = ctx.createWaveShaper();
    raspShaper.curve = this.getDistortionCurve();
    const raspPreGain = ctx.createGain();
    raspPreGain.gain.value = 0.28;

    const tractMix = ctx.createGain();
    // Syllabic glottal envelope: "The" (0-0.18), "Last" (0.22-0.56), "Dance" (0.72-1.36)
    tractMix.gain.setValueAtTime(0.001, now);
    tractMix.gain.linearRampToValueAtTime(0.45, now + 0.04);
    tractMix.gain.linearRampToValueAtTime(0.32, now + 0.16);
    tractMix.gain.linearRampToValueAtTime(0.02, now + 0.20);
    tractMix.gain.linearRampToValueAtTime(0.72, now + 0.27);
    tractMix.gain.linearRampToValueAtTime(0.62, now + 0.50);
    tractMix.gain.linearRampToValueAtTime(0.01, now + 0.58);
    tractMix.gain.linearRampToValueAtTime(0.88, now + 0.75);
    tractMix.gain.linearRampToValueAtTime(0.75, now + 1.12);
    tractMix.gain.exponentialRampToValueAtTime(0.001, now + 1.38);

    // Natural chest breathiness layer
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = noiseBuf;
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.Q.value = 1.2;
    breathBp.frequency.value = 1150;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.085;
    breathSrc.connect(breathBp);
    breathBp.connect(breathGain);
    breathGain.connect(tractMix);

    voiceCore.connect(raspPreGain);
    voiceWarm.connect(raspPreGain);
    raspPreGain.connect(raspShaper);
    raspShaper.connect(tractMix);

    // Parallel chest sub directly to dry/wet for deep heroic weight
    const subDirectGain = ctx.createGain();
    subDirectGain.gain.setValueAtTime(0.001, now);
    subDirectGain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    subDirectGain.gain.linearRampToValueAtTime(0.04, now + 0.2);
    subDirectGain.gain.linearRampToValueAtTime(0.24, now + 0.28);
    subDirectGain.gain.linearRampToValueAtTime(0.04, now + 0.58);
    subDirectGain.gain.linearRampToValueAtTime(0.32, now + 0.76);
    subDirectGain.gain.exponentialRampToValueAtTime(0.001, now + 1.38);
    subChest.connect(subDirectGain);
    subDirectGain.connect(dryBus);

    // 3 Parallel Vocal Formant Filters (F1, F2, F3) shaped across phonemes
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 4.2;
    const f1Gain = ctx.createGain();
    f1Gain.gain.value = 1.45;

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 6.2;
    const f2Gain = ctx.createGain();
    f2Gain.gain.value = 0.92;

    const f3 = ctx.createBiquadFilter();
    f3.type = 'bandpass';
    f3.Q.value = 7.5;
    const f3Gain = ctx.createGain();
    f3Gain.gain.value = 0.42;

    // Formant trajectories: "ðə" -> "l æ" -> "d æ n"
    f1.frequency.setValueAtTime(460, now);
    f1.frequency.setValueAtTime(340, now + 0.21);
    f1.frequency.linearRampToValueAtTime(670, now + 0.31);
    f1.frequency.setValueAtTime(670, now + 0.50);
    f1.frequency.setValueAtTime(300, now + 0.70);
    f1.frequency.linearRampToValueAtTime(660, now + 0.80);
    f1.frequency.linearRampToValueAtTime(320, now + 1.18);

    f2.frequency.setValueAtTime(1120, now);
    f2.frequency.setValueAtTime(980, now + 0.21);
    f2.frequency.linearRampToValueAtTime(1540, now + 0.31);
    f2.frequency.setValueAtTime(1480, now + 0.50);
    f2.frequency.setValueAtTime(1280, now + 0.70);
    f2.frequency.linearRampToValueAtTime(1520, now + 0.80);
    f2.frequency.linearRampToValueAtTime(1080, now + 1.18);

    f3.frequency.setValueAtTime(2280, now);
    f3.frequency.setValueAtTime(2420, now + 0.30);
    f3.frequency.setValueAtTime(2380, now + 0.80);

    tractMix.connect(f1);
    tractMix.connect(f2);
    tractMix.connect(f3);
    f1.connect(f1Gain);
    f2.connect(f2Gain);
    f3.connect(f3Gain);
    f1Gain.connect(dryBus);
    f2Gain.connect(dryBus);
    f3Gain.connect(dryBus);

    // Consonant shaping bursts: "Th" (0.00), "-st" (0.53-0.62), "D-" thump (0.71), "-nce" sibilant (1.20-1.46)
    const addConsonant = (offset: number, type: BiquadFilterType, freq: number, q: number, vol: number, dur: number) => {
      const t0 = now + offset;
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = noiseBuf;
      const cFlt = ctx.createBiquadFilter();
      cFlt.type = type;
      cFlt.Q.value = q;
      cFlt.frequency.setValueAtTime(freq, t0);
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.001, t0);
      cGain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.25));
      cGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      cSrc.connect(cFlt);
      cFlt.connect(cGain);
      cGain.connect(dryBus);
      cSrc.start(t0, 0.1, dur + 0.02);
    };

    addConsonant(0.0, 'bandpass', 1750, 1.5, 0.09, 0.06); // "Th-"
    addConsonant(0.51, 'highpass', 3800, 1.0, 0.11, 0.09); // "-s-"
    addConsonant(0.60, 'bandpass', 2400, 1.8, 0.13, 0.045); // "-t"
    addConsonant(0.71, 'lowpass', 420, 0.9, 0.22, 0.055); // heavy "D-"
    addConsonant(1.18, 'highpass', 4300, 1.1, 0.14, 0.26); // "-nce!"

    // Deep heroic sub-boom impact punctuating "Dance!"
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(118, now + 0.71);
    boom.frequency.exponentialRampToValueAtTime(30, now + 1.25);
    boomGain.gain.setValueAtTime(0.24, now + 0.71);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.28);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);

    voiceCore.start(now);
    voiceWarm.start(now);
    subChest.start(now);
    gravelLfo.start(now);
    breathSrc.start(now, 0, totalDur);
    boom.start(now + 0.71);

    voiceCore.stop(now + 1.42);
    voiceWarm.stop(now + 1.42);
    subChest.stop(now + 1.42);
    gravelLfo.stop(now + 1.42);
    breathSrc.stop(now + 1.42);
    boom.stop(now + 1.3);
  }

  public playWingClapBoom(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.34);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(980, now);
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.22, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(lp);
    lp.connect(nG);
    nG.connect(ctx.destination);
    src.start(now, 0, 0.3);
  }

  public playVortexSpin(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
    bp.frequency.exponentialRampToValueAtTime(480, now + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now, 0.1, 0.7);
  }

  public playJump(jumpIndex = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startF = jumpIndex === 3 ? 440 : jumpIndex === 2 ? 320 : 210;
    const endF = jumpIndex === 3 ? 820 : jumpIndex === 2 ? 620 : 460;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.085);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(640, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.09);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.09, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now, 0.2, 0.11);
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const fanfare = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 0.12, d: 0.12 },
      { f: 783.99, t: 0.24, d: 0.12 },
      { f: 1046.5, t: 0.37, d: 0.42 },
    ];
    fanfare.forEach(({ f, t, d }) => {
      const start = now + t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + d + 0.02);
    });
  }

  public playDefeat(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 392.0, t: 0, d: 0.16 },
      { f: 349.23, t: 0.16, d: 0.16 },
      { f: 311.13, t: 0.32, d: 0.16 },
      { f: 261.63, t: 0.48, d: 0.42 },
    ];
    notes.forEach(({ f, t, d }) => {
      const start = now + t;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + d + 0.02);
    });
  }

  // Sinister multi-syllable echoing Dragon laugh ("HAA-HA-HA-HAA")
  public playDragonLaugh(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bursts = [
      { t: 0.0, f: 112, dur: 0.22 },
      { t: 0.24, f: 96, dur: 0.2 },
      { t: 0.47, f: 84, dur: 0.22 },
      { t: 0.72, f: 74, dur: 0.36 },
    ];
    bursts.forEach(({ t, f, dur }) => {
      const t0 = now + t;
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const shaper = ctx.createWaveShaper();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 1.18, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + dur);

      sub.type = 'triangle';
      sub.frequency.setValueAtTime(f * 0.55, t0);
      sub.frequency.exponentialRampToValueAtTime(f * 0.38, t0 + dur);

      shaper.curve = this.getDistortionCurve();
      bp.type = 'bandpass';
      bp.Q.value = 1.8;
      bp.frequency.setValueAtTime(460, t0);
      bp.frequency.linearRampToValueAtTime(250, t0 + dur);

      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.17, t0 + 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(shaper);
      sub.connect(shaper);
      shaper.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);

      osc.start(t0);
      sub.start(t0);
      osc.stop(t0 + dur + 0.02);
      sub.stop(t0 + dur + 0.02);
    });
  }

  // Low gritty Warrior chuckle before rising
  public playWarriorChuckle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.16, 0.32].forEach((offset, idx) => {
      const t0 = now + offset;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const base = 115 - idx * 8;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 0.78, t0 + 0.11);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(520, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.09, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    });
  }

  // Faint metallic sword scrape on stone during exhausted walk
  public playBladeScrape(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 4.0;
    bp.frequency.setValueAtTime(1650, now);
    bp.frequency.linearRampToValueAtTime(1120, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(now, 0.15, 0.2);
  }

  // Heavy fatal steel severing slash for Warrior Victory cutscene
  public playDecapitateSlash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playComboSlash(3, true, 'katana');
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.38);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Visceral jaw snap + devour crunch for Dragon Defeat cutscene
  public playDragonDevour(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playDragonSnarl(true);
    const now = ctx.currentTime;
    const noiseBuf = this.getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(980, now + 0.05);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    src.start(now + 0.04, 0.1, 0.38);
  }
}

export const sound = new RealisticBattleAudioEngine();
