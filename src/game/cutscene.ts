export type CutscenePhase =
  | 'IDLE'
  | 'FIRST_ENTRY_WALK'
  | 'DRAGON_AMBUSH'
  | 'WARRIOR_RECOVER_3S'
  | 'COMBAT'
  | 'VICTORY_CUTSCENE'
  | 'DEFEAT_CUTSCENE';

export type DialogueSpeaker = 'warrior' | 'dragon';
export type DialogueDelivery = 'normal' | 'stammer' | 'tremble' | 'booming';
export type BanterTrigger = 'player_hit' | 'player_miss' | 'player_heal' | 'periodic';

export type CutsceneSfxHook =
  | 'blade_scrape'
  | 'dragon_laugh'
  | 'dragon_blink'
  | 'ambush_hit'
  | 'warrior_chuckle'
  | 'warrior_stance'
  | 'decapitate'
  | 'dragon_devour';

export interface DialogueCue {
  id: string;
  speaker: DialogueSpeaker;
  speakerName: string;
  text: string;
  delivery: DialogueDelivery;
  durationSec: number;
  isBanter?: boolean;
  sfxHook?: CutsceneSfxHook;
}

export interface CutsceneFlags {
  hasSeenIntroCutscene: boolean;
  hasSeenVictoryCutscene: boolean;
  hasSeenDefeatCutscene: boolean;
}

const CUTSCENE_FLAGS_KEY = 'tfbth_cutscene_flags_v1';

export const DEFAULT_CUTSCENE_FLAGS: CutsceneFlags = {
  hasSeenIntroCutscene: false,
  hasSeenVictoryCutscene: false,
  hasSeenDefeatCutscene: false,
};

export function loadCutsceneFlags(): CutsceneFlags {
  if (typeof window === 'undefined') return { ...DEFAULT_CUTSCENE_FLAGS };
  try {
    const raw = window.localStorage.getItem(CUTSCENE_FLAGS_KEY);
    if (!raw) return { ...DEFAULT_CUTSCENE_FLAGS };
    const parsed = JSON.parse(raw) as Partial<CutsceneFlags>;
    return {
      hasSeenIntroCutscene: Boolean(parsed.hasSeenIntroCutscene),
      hasSeenVictoryCutscene: Boolean(parsed.hasSeenVictoryCutscene),
      hasSeenDefeatCutscene: Boolean(parsed.hasSeenDefeatCutscene),
    };
  } catch {
    return { ...DEFAULT_CUTSCENE_FLAGS };
  }
}

export function saveCutsceneFlags(flags: CutsceneFlags): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUTSCENE_FLAGS_KEY, JSON.stringify(flags));
  } catch {
    // Ignore storage errors
  }
}

export function resetCutsceneFlags(): CutsceneFlags {
  const fresh = { ...DEFAULT_CUTSCENE_FLAGS };
  saveCutsceneFlags(fresh);
  return fresh;
}

// Reusable tween & timing helpers
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

export function easeOutCubic(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

export function easeInOutQuad(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export const CORE_CUTSCENE_VOICE_CUES: DialogueCue[] = [
  {
    id: 'intro_stammer',
    speaker: 'warrior',
    speakerName: 'Warrior',
    text: 'I... I c-can do this...',
    delivery: 'stammer',
    durationSec: 3.5,
  },
  {
    id: 'intro_resolve',
    speaker: 'warrior',
    speakerName: 'Warrior',
    text: 'Only one left... and I can finally break free from this reality. I will end him.',
    delivery: 'normal',
    durationSec: 4.9,
  },
  {
    id: 'dragon_pity',
    speaker: 'dragon',
    speakerName: 'Armored Wyvern',
    text: 'How pathetic... I pity you. All this... for what?',
    delivery: 'booming',
    durationSec: 3.8,
    sfxHook: 'dragon_laugh',
  },
  {
    id: 'dragon_die',
    speaker: 'dragon',
    speakerName: 'Armored Wyvern',
    text: 'Die!',
    delivery: 'booming',
    durationSec: 1.05,
  },
  {
    id: 'warrior_recover',
    speaker: 'warrior',
    speakerName: 'Warrior',
    text: 'Do you think I give up that easily?',
    delivery: 'normal',
    durationSec: 2.55,
    sfxHook: 'warrior_chuckle',
  },
  {
    id: 'victory_whisper',
    speaker: 'warrior',
    speakerName: 'Warrior',
    text: 'I... won...',
    delivery: 'tremble',
    durationSec: 2.1,
  },
  {
    id: 'defeat_mockery',
    speaker: 'dragon',
    speakerName: 'Armored Wyvern',
    text: 'How utterly pathetic.',
    delivery: 'booming',
    durationSec: 2.4,
  },
];

interface BanterEntry {
  id: string;
  trigger: BanterTrigger;
  text: string;
}

const DRAGON_BANTER_POOL: BanterEntry[] = [
  { id: 'hit_1', trigger: 'player_hit', text: 'Pathetic. Did that sting, little insect?' },
  { id: 'hit_2', trigger: 'player_hit', text: 'Your fragile bones break so amusingly.' },
  { id: 'hit_3', trigger: 'player_hit', text: 'Kneel before perfection!' },
  { id: 'miss_1', trigger: 'player_miss', text: 'Swinging at shadows? How embarrassing.' },
  { id: 'miss_2', trigger: 'player_miss', text: 'Too slow! Were you even aiming at me?' },
  { id: 'miss_3', trigger: 'player_miss', text: 'A blind hatchling fights better than you.' },
  { id: 'heal_1', trigger: 'player_heal', text: 'Clinging to life with borrowed sparks? Futile.' },
  { id: 'heal_2', trigger: 'player_heal', text: 'Patch all you want. You only delay the inevitable.' },
  { id: 'gen_1', trigger: 'periodic', text: 'I am eternal. You are merely passing dust.' },
  { id: 'gen_2', trigger: 'periodic', text: 'Look at you, trembling in my shadow.' },
  { id: 'gen_3', trigger: 'periodic', text: 'This realm bows to me—and soon, so will your corpse.' },
  { id: 'gen_4', trigger: 'periodic', text: 'Amuse me a little longer, mortal.' },
];

export class BanterDirector {
  private cooldownTimer = 8.5;
  private periodicTimer = 15.0;
  private usedIds = new Set<string>();
  private lastLineId: string | null = null;

  public reset(): void {
    this.cooldownTimer = 7.5;
    this.periodicTimer = 14.5;
    this.usedIds.clear();
    this.lastLineId = null;
  }

  public update(dt: number, canSpeak: boolean): DialogueCue | null {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    this.periodicTimer -= dt;
    if (this.periodicTimer <= 0 && canSpeak) {
      this.periodicTimer = 15 + Math.random() * 6;
      return this.tryTrigger('periodic', true);
    }
    return null;
  }

  public tryTrigger(trigger: BanterTrigger, canSpeak: boolean): DialogueCue | null {
    if (!canSpeak || this.cooldownTimer > 0) return null;

    let candidates = DRAGON_BANTER_POOL.filter(
      (b) => b.trigger === trigger && !this.usedIds.has(b.id) && b.id !== this.lastLineId,
    );
    if (candidates.length === 0) {
      // Reset context usage if all lines in this category were cycled
      DRAGON_BANTER_POOL.filter((b) => b.trigger === trigger).forEach((b) =>
        this.usedIds.delete(b.id),
      );
      candidates = DRAGON_BANTER_POOL.filter(
        (b) => b.trigger === trigger && b.id !== this.lastLineId,
      );
    }
    if (candidates.length === 0) {
      candidates = DRAGON_BANTER_POOL;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.usedIds.add(pick.id);
    this.lastLineId = pick.id;
    this.cooldownTimer = 11.5;
    this.periodicTimer = 14 + Math.random() * 6;

    return {
      id: `banter_${pick.id}_${Date.now()}`,
      speaker: 'dragon',
      speakerName: 'Armored Wyvern',
      text: pick.text,
      delivery: 'booming',
      durationSec: 3.1,
      isBanter: true,
    };
  }
}

export interface CutsceneAnimationHooks {
  onPhaseChange?: (phase: CutscenePhase, flags: CutsceneFlags) => void;
  onDialogueChange?: (cue: DialogueCue | null) => void;
  onSfxTrigger?: (hook: CutsceneSfxHook) => void;
  onAmbushStrike?: () => void;
  onDragonDecapitate?: () => void;
  onDragonDevour?: () => void;
  onCombatStart?: () => void;
  onEndingComplete?: (outcome: 'warrior' | 'dragon') => void;
}

export class CutsceneDirector {
  private phase: CutscenePhase = 'IDLE';
  private phaseTime = 0;
  private stepIndex = 0;
  private flags: CutsceneFlags;
  private hooks: CutsceneAnimationHooks;
  private banter = new BanterDirector();
  private activeDialogue: DialogueCue | null = null;
  private dialogueTimer = 0;
  private walkScrapeAccum = 0;

  constructor(hooks: CutsceneAnimationHooks = {}) {
    this.hooks = hooks;
    this.flags = loadCutsceneFlags();
  }

  public getPhase(): CutscenePhase {
    return this.phase;
  }

  public getPhaseTime(): number {
    return this.phaseTime;
  }

  public getStepIndex(): number {
    return this.stepIndex;
  }

  public getFlags(): CutsceneFlags {
    return { ...this.flags };
  }

  public getActiveDialogue(): DialogueCue | null {
    return this.activeDialogue;
  }

  public isCutsceneLocked(): boolean {
    return (
      this.phase === 'FIRST_ENTRY_WALK' ||
      this.phase === 'DRAGON_AMBUSH' ||
      this.phase === 'WARRIOR_RECOVER_3S' ||
      this.phase === 'VICTORY_CUTSCENE' ||
      this.phase === 'DEFEAT_CUTSCENE'
    );
  }

  public resetSavedFlags(): CutsceneFlags {
    this.flags = resetCutsceneFlags();
    return this.getFlags();
  }

  public beginBattle(forceReplayIntro = false): CutscenePhase {
    this.banter.reset();
    this.clearDialogue();

    if (forceReplayIntro || !this.flags.hasSeenIntroCutscene) {
      this.enterPhase('FIRST_ENTRY_WALK');
      this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[0]);
    } else {
      this.enterPhase('COMBAT');
      this.hooks.onCombatStart?.();
    }

    return this.phase;
  }

  public beginEnding(winner: 'warrior' | 'dragon'): boolean {
    this.clearDialogue();
    if (winner === 'warrior') {
      if (this.flags.hasSeenVictoryCutscene) {
        return false;
      }
      this.enterPhase('VICTORY_CUTSCENE');
      return true;
    } else {
      if (this.flags.hasSeenDefeatCutscene) {
        return false;
      }
      this.enterPhase('DEFEAT_CUTSCENE');
      this.hooks.onSfxTrigger?.('dragon_laugh');
      return true;
    }
  }

  public resetToIdle(): void {
    this.clearDialogue();
    this.enterPhase('IDLE');
  }

  public skipCurrentCutscene(): void {
    if (!this.isCutsceneLocked()) return;
    this.clearDialogue();

    if (
      this.phase === 'FIRST_ENTRY_WALK' ||
      this.phase === 'DRAGON_AMBUSH' ||
      this.phase === 'WARRIOR_RECOVER_3S'
    ) {
      this.flags = { ...this.flags, hasSeenIntroCutscene: true };
      saveCutsceneFlags(this.flags);
      this.hooks.onSfxTrigger?.('warrior_stance');
      this.enterPhase('COMBAT');
      this.hooks.onCombatStart?.();
      return;
    }

    if (this.phase === 'VICTORY_CUTSCENE') {
      this.flags = { ...this.flags, hasSeenVictoryCutscene: true };
      saveCutsceneFlags(this.flags);
      this.enterPhase('IDLE');
      this.hooks.onEndingComplete?.('warrior');
      return;
    }

    if (this.phase === 'DEFEAT_CUTSCENE') {
      this.flags = { ...this.flags, hasSeenDefeatCutscene: true };
      saveCutsceneFlags(this.flags);
      this.enterPhase('IDLE');
      this.hooks.onEndingComplete?.('dragon');
    }
  }

  public notifyCombatEvent(trigger: BanterTrigger, canSpeak: boolean): void {
    if (this.phase !== 'COMBAT') return;
    if (this.activeDialogue) return;
    const cue = this.banter.tryTrigger(trigger, canSpeak);
    if (cue) {
      this.emitDialogue(cue);
    }
  }

  public update(dt: number, canBanterSpeak: boolean): void {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer = Math.max(0, this.dialogueTimer - dt);
      if (this.dialogueTimer === 0 && this.activeDialogue) {
        this.clearDialogue();
      }
    }

    if (this.phase === 'IDLE') return;

    this.phaseTime += dt;

    if (this.phase === 'FIRST_ENTRY_WALK') {
      this.walkScrapeAccum += dt;
      if (this.walkScrapeAccum >= 1.15) {
        this.walkScrapeAccum = 0;
        this.hooks.onSfxTrigger?.('blade_scrape');
      }
      if (this.stepIndex === 0 && this.phaseTime >= 3.6) {
        this.stepIndex = 1;
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[1]);
      } else if (this.stepIndex === 1 && this.phaseTime >= 8.6) {
        this.enterPhase('DRAGON_AMBUSH');
        this.hooks.onSfxTrigger?.('dragon_laugh');
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[2]);
      }
      return;
    }

    if (this.phase === 'DRAGON_AMBUSH') {
      if (this.stepIndex === 0 && this.phaseTime >= 3.9) {
        this.stepIndex = 1;
        this.hooks.onSfxTrigger?.('dragon_blink');
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[3]);
      } else if (this.stepIndex === 1 && this.phaseTime >= 4.55) {
        this.stepIndex = 2;
        this.hooks.onSfxTrigger?.('ambush_hit');
        this.hooks.onAmbushStrike?.();
      } else if (this.stepIndex === 2 && this.phaseTime >= 5.55) {
        this.enterPhase('WARRIOR_RECOVER_3S');
      }
      return;
    }

    if (this.phase === 'WARRIOR_RECOVER_3S') {
      if (this.stepIndex === 0 && this.phaseTime >= 0.45) {
        this.stepIndex = 1;
        this.hooks.onSfxTrigger?.('warrior_chuckle');
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[4]);
      } else if (this.phaseTime >= 3.0) {
        this.clearDialogue();
        this.flags = { ...this.flags, hasSeenIntroCutscene: true };
        saveCutsceneFlags(this.flags);
        this.hooks.onSfxTrigger?.('warrior_stance');
        this.enterPhase('COMBAT');
        this.hooks.onCombatStart?.();
      }
      return;
    }

    if (this.phase === 'COMBAT') {
      const cue = this.banter.update(dt, canBanterSpeak && !this.activeDialogue);
      if (cue) {
        this.emitDialogue(cue);
      }
      return;
    }

    if (this.phase === 'VICTORY_CUTSCENE') {
      if (this.stepIndex === 0 && this.phaseTime >= 1.55) {
        this.stepIndex = 1;
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[5]);
      } else if (this.stepIndex === 1 && this.phaseTime >= 3.75) {
        this.stepIndex = 2;
        this.clearDialogue();
        this.hooks.onSfxTrigger?.('decapitate');
        this.hooks.onDragonDecapitate?.();
      } else if (this.stepIndex === 2 && this.phaseTime >= 5.05) {
        this.flags = { ...this.flags, hasSeenVictoryCutscene: true };
        saveCutsceneFlags(this.flags);
        this.enterPhase('IDLE');
        this.hooks.onEndingComplete?.('warrior');
      }
      return;
    }

    if (this.phase === 'DEFEAT_CUTSCENE') {
      if (this.stepIndex === 0 && this.phaseTime >= 1.35) {
        this.stepIndex = 1;
        this.hooks.onSfxTrigger?.('dragon_devour');
        this.hooks.onDragonDevour?.();
      } else if (this.stepIndex === 1 && this.phaseTime >= 2.75) {
        this.stepIndex = 2;
        this.emitDialogue(CORE_CUTSCENE_VOICE_CUES[6]);
      } else if (this.stepIndex === 2 && this.phaseTime >= 5.25) {
        this.clearDialogue();
        this.flags = { ...this.flags, hasSeenDefeatCutscene: true };
        saveCutsceneFlags(this.flags);
        this.enterPhase('IDLE');
        this.hooks.onEndingComplete?.('dragon');
      }
    }
  }

  private enterPhase(next: CutscenePhase): void {
    this.phase = next;
    this.phaseTime = 0;
    this.stepIndex = 0;
    this.walkScrapeAccum = 0;
    this.hooks.onPhaseChange?.(next, { ...this.flags });
  }

  private emitDialogue(cue: DialogueCue): void {
    this.activeDialogue = cue;
    this.dialogueTimer = cue.durationSec;
    this.hooks.onDialogueChange?.(cue);
  }

  private clearDialogue(): void {
    if (!this.activeDialogue) return;
    this.activeDialogue = null;
    this.dialogueTimer = 0;
    this.hooks.onDialogueChange?.(null);
  }
}
