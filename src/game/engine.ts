import { sound } from './sound';
import { getGameSprites, type GameSprites, type SpriteSheet } from './sprites';
import {
  BATTLE_CONFIG,
  SUPER_SKILL_LIST,
  WEAPON_LIST,
  type BattleSummary,
  type CombatEvent,
  type HudSnapshot,
  type SuperSkillType,
  type WeaponType,
} from './types';

// ~33% zoomed-out wide FOV (480x270 16:9 native pixel buffer)
export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;
export const WORLD_WIDTH = 720;
export const WORLD_HEIGHT = 340;
const BASE_GROUND_Y = 278;
const FIXED_DT = 1 / 60;
const WARRIOR_FEET_OFFSET = 24;
const WYVERN_W = 80;
const WYVERN_H = 56;

interface Platform {
  x: number;
  y: number;
  w: number;
  oneWay: boolean;
}

const PLATFORMS: Platform[] = [
  { x: 16, y: 274, w: 184, oneWay: false }, // Left stepped terrace
  { x: 200, y: 278, w: 300, oneWay: false }, // Center shallow dip terrace
  { x: 500, y: 272, w: 204, oneWay: false }, // Right stepped terrace above cave arch
  { x: 76, y: 226, w: 128, oneWay: true }, // Left elevated stone ledge
  { x: 284, y: 188, w: 152, oneWay: true }, // Center middle ruins ledge (mossy boulder)
  { x: 516, y: 222, w: 128, oneWay: true }, // Right elevated stone ledge
];

const DROP_SPOTS: { x: number; y: number }[] = [
  { x: 136, y: 226 },
  { x: 360, y: 188 },
  { x: 576, y: 222 },
  { x: 250, y: 278 },
  { x: 430, y: 278 },
  { x: 122, y: 274 },
  { x: 560, y: 272 },
];

interface WeaponSpec {
  reach: number;
  height: number;
  offsetY: number;
  baseDmg: [number, number, number];
  critMult: number;
  durations: [number, number, number];
  cooldowns: [number, number, number];
  knockback: number;
  smearColor: string;
  arcSpan: number;
  isThrust?: boolean;
}

const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  broadsword: {
    reach: 22,
    height: 20,
    offsetY: 4,
    baseDmg: [20, 22, 28],
    critMult: 1.5,
    durations: [0.14, 0.14, 0.19],
    cooldowns: [0.16, 0.16, 0.25],
    knockback: 9,
    smearColor: '#66f2ff',
    arcSpan: 10,
  },
  daggers: {
    reach: 15,
    height: 17,
    offsetY: 6,
    baseDmg: [14, 16, 22],
    critMult: 1.85,
    durations: [0.095, 0.095, 0.13],
    cooldowns: [0.11, 0.11, 0.18],
    knockback: 5,
    smearColor: '#34d399',
    arcSpan: 8,
  },
  spear: {
    reach: 28,
    height: 12,
    offsetY: 9,
    baseDmg: [19, 21, 27],
    critMult: 1.65,
    durations: [0.15, 0.15, 0.2],
    cooldowns: [0.18, 0.18, 0.26],
    knockback: 11,
    smearColor: '#93c5fd',
    arcSpan: 7,
    isThrust: true,
  },
  axe: {
    reach: 21,
    height: 22,
    offsetY: 3,
    baseDmg: [25, 28, 36],
    critMult: 1.5,
    durations: [0.18, 0.18, 0.23],
    cooldowns: [0.22, 0.22, 0.32],
    knockback: 15,
    smearColor: '#f57e25',
    arcSpan: 13,
  },
  katana: {
    reach: 24,
    height: 18,
    offsetY: 5,
    baseDmg: [18, 21, 27],
    critMult: 1.7,
    durations: [0.12, 0.12, 0.17],
    cooldowns: [0.14, 0.14, 0.21],
    knockback: 8,
    smearColor: '#a78bfa',
    arcSpan: 12,
  },
  mace: {
    reach: 20,
    height: 22,
    offsetY: 3,
    baseDmg: [24, 27, 34],
    critMult: 1.55,
    durations: [0.19, 0.19, 0.25],
    cooldowns: [0.23, 0.23, 0.33],
    knockback: 16,
    smearColor: '#ffd147',
    arcSpan: 12,
  },
};

function getBaseFloorYAt(x: number): number {
  if (x < 200) return 274;
  if (x < 500) return 278;
  return 272;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
  splats?: boolean;
}

interface SplatDecal {
  x: number;
  y: number;
  w: number;
  color: string;
  life: number;
}

interface GhostImage {
  x: number;
  y: number;
  facing: 1 | -1;
  frame: number;
  life: number;
  maxLife: number;
}

interface WyvernTrail {
  x: number;
  y: number;
  facing: 1 | -1;
  infernal: boolean;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
}

interface CrystalShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  reflected: boolean;
  fiery: boolean;
  homing?: boolean;
}

interface SlashWave {
  x: number;
  y: number;
  vx: number;
  life: number;
  hitDone: boolean;
}

interface LightningStrike {
  x: number;
  delay: number;
  flashLife: number;
  struck: boolean;
}

interface FlamePatch {
  x: number;
  y: number;
  w: number;
  life: number;
  maxLife: number;
}

interface FlamePillar {
  x: number;
  y: number;
  warnTimer: number;
  activeTimer: number;
  hitDone: boolean;
}

interface EmberOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  maxFuse: number;
}

interface BossWave {
  x: number;
  y: number;
  vx: number;
  life: number;
  fiery: boolean;
  tall?: boolean;
}

interface WeaponDrop {
  weapon: WeaponType;
  x: number;
  y: number;
}

interface SkillDrop {
  skill: SuperSkillType;
  x: number;
  y: number;
}

interface SlashSmear {
  active: boolean;
  x: number;
  y: number;
  facing: 1 | -1;
  comboStep: number;
  weapon: WeaponType;
  isCrit: boolean;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface CloakNode {
  x: number;
  y: number;
}

type WyvernAiState =
  | 'hover'
  | 'reposition_glide'
  | 'wing_vault'
  // Phase 1 (5 moves)
  | 'p1_swoop_windup'
  | 'p1_swoop_dive'
  | 'p1_tail_windup'
  | 'p1_tail_snap'
  | 'p1_shard_volley'
  | 'p1_gust_backstep'
  | 'p1_gust_dash'
  | 'p1_beam_windup'
  | 'p1_beam_sweep'
  // Phase 2 (10 moves)
  | 'p2_combo_windup'
  | 'p2_combo_strike'
  | 'p2_beam_windup'
  | 'p2_beam_sweep'
  | 'p2_feint_blink'
  | 'p2_blink_ambush'
  | 'p2_meteor_barrage'
  | 'p2_tail_windup'
  | 'p2_tail_double'
  | 'p2_slam_rise'
  | 'p2_slam_drop'
  | 'p2_vortex_pull'
  | 'p2_vortex_bite'
  | 'p2_ember_orbs'
  | 'p2_spiral_windup'
  | 'p2_spiral_charge'
  | 'p2_roar_nova_windup'
  | 'p2_roar_nova_dash'
  // Apex "Last Dance" Overdrive (Moves 11–20)
  | 'ld_triple_blink_windup'
  | 'ld_triple_blink_slash'
  | 'ld_xbeam_windup'
  | 'ld_xbeam_sweep'
  | 'ld_skyfall_rise'
  | 'ld_skyfall_crash'
  | 'ld_tailsaw_windup'
  | 'ld_tailsaw_spin'
  | 'ld_fake_stagger'
  | 'ld_bait_uppercut'
  | 'ld_wingclap_windup'
  | 'ld_wingclap_slam'
  | 'ld_triswoop_windup'
  | 'ld_triswoop_dive'
  | 'ld_matrix_windup'
  | 'ld_matrix_hold'
  | 'ld_phoenix_swarm'
  | 'ld_finisher_roar'
  | 'ld_finisher_blink'
  | 'ld_finisher_breath'
  | 'ld_finisher_tailslam'
  // Shared transition & status states
  | 'blink_fade'
  | 'death_fakeout'
  | 'transforming'
  | 'dragon_react'
  | 'last_dance_charge'
  | 'stunned'
  | 'recover'
  | 'defeated';

const PIXEL_GLYPHS: Record<string, string[]> = {
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onBattleEnd: (summary: BattleSummary) => void;
}

export class PixelBattleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: GameSprites;
  private callbacks: EngineCallbacks;

  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private elapsed = 0;
  private battleElapsed = 0;
  private paused = false;
  private titleMode = true;
  private battleEnded = false;
  private endDelayTimer = 0;
  private pendingWinner: 'warrior' | 'dragon' | null = null;

  private camX = 120;
  private camY = 58;

  private heldLeft = false;
  private heldRight = false;
  private heldDown = false;
  private jumpHeld = false;
  private jumpBuffer = 0;
  private rollBuffer = 0;
  private attackBuffer = 0;
  private parryBuffer = 0;
  private healQueued = false;
  private dropThroughTimer = 0;

  private hitstopTimer = 0;
  private shakeTimer = 0;
  private shakeDirX = 0;
  private shakeDirY = 0;
  private shakeMagnitude = 0;

  // Bearded 32x32 Warrior state
  private wX = 180;
  private wY = 274 - WARRIOR_FEET_OFFSET;
  private wVx = 0;
  private wVy = 0;
  private wFacing: 1 | -1 = 1;
  private wGrounded = true;
  private wCoyoteTimer = 0;
  private wAirJumpsLeft = 1;
  private wHp: number = BATTLE_CONFIG.warriorBaseHp;
  private wMaxHp: number = BATTLE_CONFIG.warriorBaseHp;
  private wShield = 0;
  private wAwakened = false;
  private wAwakenedRisen = false;
  private wAwakeningTimer = 0;
  private wWeapon: WeaponType = 'broadsword';
  private wDeathTimer = 0;

  // 10s Random Weapon Drop + 20s Balanced Super Skill Drop
  private weaponDropTimer: number = BATTLE_CONFIG.weaponDropIntervalSec;
  private activeDrop: WeaponDrop | null = null;
  private superSkillTimer: number = BATTLE_CONFIG.superSkillIntervalSec;
  private activeSkillDrop: SkillDrop | null = null;
  private lastSuperSkill: SuperSkillType | null = null;
  private activeBuff: SuperSkillType | null = null;
  private activeBuffTimer = 0;
  private lightningQueue: LightningStrike[] = [];
  private slashWaves: SlashWave[] = [];

  // Combat & Action state
  private wComboStep = 0;
  private wComboWindow = 0;
  private wAttackTimer = 0;
  private wAttackDuration = 0.14;
  private wAttackCooldown = 0;
  private wAttackHitDone = false;
  private wDiveSlamming = false;

  private wParryTimer = 0;
  private wParryCooldown = 0;
  private wHealAnimTimer = 0;
  private wHealCooldown = 0;
  private wHealCharges: number = BATTLE_CONFIG.maxHealCharges;
  private flameBurnCooldown = 0;

  private wRollTimer = 0;
  private wRollCooldown = 0;
  private wGhostSpawnAccum = 0;
  private wRollDustCount = 0;
  private wRollBoltDone = false;

  private wHurtTimer = 0;
  private wFlashTimer = 0;
  private wInvulnTimer = 0;
  private wWalkClock = 0;

  private cloakNodes: CloakNode[] = [];

  // Heavy Armored Dragon Boss -> Death Fake-out -> Infernal Phase 2 (1500 HP) -> Furious Mutual Power-up
  private dX = 460;
  private dY = 172;
  private dVx = 0;
  private dVy = 0;
  private dFacing: 1 | -1 = -1;
  private dHp: number = BATTLE_CONFIG.dragonMaxHp;
  private dMaxHp: number = BATTLE_CONFIG.dragonMaxHp;
  private dAiState: WyvernAiState = 'hover';
  private dAiTimer = 0.9;
  private dHoverTargetX = 460;
  private dHoverTargetY = 172;
  private dLastAttack = '';
  private dMoveHistory: string[] = [];
  private dQueuedChain: WyvernAiState | null = null;
  private dBlinkAfterMove: WyvernAiState = 'p2_blink_ambush';
  private dPhase2Triggered = false;
  private dFurious = false;
  private dReactRoared = false;
  private lastDanceMode = false;
  private lastDanceTimer = 0;
  private lastDanceVoicePlayed = false;
  private lastDanceRoarPlayed = false;
  private ldZoom = 1;
  private ldLetterbox = 0;
  private ldXBeamAngle2 = 0;
  private ldXBeamStart2 = 0;
  private ldXBeamEnd2 = 0;
  private ldXBeamHitDone = false;
  private ldSkyTargetX = 320;
  private ldSawSpinAccum = 0;
  private ldFinisherStep = 0;
  private dRecentHits = 0;
  private dHitDecayTimer = 0;
  private dPlayerCampTimer = 0;
  private dPlayerRollSpam = 0;
  private dPlayerRollDecay = 0;
  private dDwellTimer = 0;
  private dDwellAnchorX = 490;
  private dDwellAnchorY = 195;
  private dCornerCrowdTimer = 0;
  private dFlankSide: 1 | -1 = 1;
  private dGlideTime = 0;
  private dReboundTimer = 0;
  private dRecoverAnchorX = 460;
  private dVaultTargetX = 240;

  private dFeintDone = false;
  private dFakeoutLanded = false;
  private dTailHitDone = false;
  private dSwoopHitDone = false;
  private dDashHitDone = false;
  private dComboHitIndex = 0;
  private dComboHitDone = false;
  private dSpiralPass = 0;
  private dSpiralHitDone = false;
  private dBurstRemaining = 0;
  private dBurstTimer = 0;
  private dMeteorRemaining = 0;
  private dMeteorTimer = 0;
  private dBeamStartAngle = 0;
  private dBeamEndAngle = 0;
  private dBeamCurrentAngle = 0;
  private dBeamHitDone = false;
  private dBeamTickTimer = 0;
  private dFlameDropAccum = 0;
  private dBlinkTargetX = 320;
  private dBlinkTargetY = 166;
  private dHurtTimer = 0;
  private dFlashTimer = 0;
  private dWingFlakeAccum = 0;
  private dTailSparkAccum = 0;

  // Stats & HUD tracking
  private lastEvent: CombatEvent = { type: 'ready' };
  private damageDealt = 0;
  private damageTaken = 0;
  private totalHealed = 0;
  private attacksLanded = 0;
  private critsLanded = 0;
  private parriesLanded = 0;
  private hudSyncAccum = 0;

  // VFX & Hazard pools
  private shards: CrystalShard[] = [];
  private flamePatches: FlamePatch[] = [];
  private flamePillars: FlamePillar[] = [];
  private emberOrbs: EmberOrb[] = [];
  private bossWaves: BossWave[] = [];
  private particles: Particle[] = [];
  private splats: SplatDecal[] = [];
  private ghosts: GhostImage[] = [];
  private wyvernTrails: WyvernTrail[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];
  private forestMotes: { x: number; y: number; speed: number; drift: number; color: string }[] = [];
  private slashSmear: SlashSmear = {
    active: false,
    x: 0,
    y: 0,
    facing: 1,
    comboStep: 1,
    weapon: 'broadsword',
    isCrit: false,
    life: 0,
    maxLife: 0.14,
  };

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.canvas.width = VIEW_WIDTH;
    this.canvas.height = VIEW_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = getGameSprites();
    this.callbacks = callbacks;

    this.initCloak();

    const moteColors = ['#c3eaeb', '#8cf274', '#a6d8db', '#f5f5c6'];
    for (let i = 0; i < 36; i++) {
      this.forestMotes.push({
        x: Math.random() * WORLD_WIDTH,
        y: 60 + Math.random() * (WORLD_HEIGHT - 80),
        speed: 4 + Math.random() * 8,
        drift: Math.random() * Math.PI * 2,
        color: moteColors[i % moteColors.length],
      });
    }
  }

  private initCloak(): void {
    this.cloakNodes = [];
    for (let i = 0; i < 6; i++) {
      this.cloakNodes.push({ x: this.wX + 14 - i * 2, y: this.wY + 13 });
    }
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);
      this.accumulator += clampedDt;

      while (this.accumulator >= FIXED_DT) {
        this.stepFixed(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }

      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.clearHeldInputs();
  }

  public setTitleMode(isTitle: boolean): void {
    this.titleMode = isTitle;
    if (isTitle) this.clearHeldInputs();
  }

  public clearHeldInputs(): void {
    this.heldLeft = false;
    this.heldRight = false;
    this.heldDown = false;
    this.jumpHeld = false;
    this.jumpBuffer = 0;
    this.rollBuffer = 0;
    this.attackBuffer = 0;
    this.parryBuffer = 0;
    this.healQueued = false;
  }

  private isCinematicLocked(): boolean {
    return this.wAwakeningTimer > 0 || this.lastDanceTimer > 0;
  }

  public setMoveLeft(held: boolean): void {
    this.heldLeft = this.isCinematicLocked() ? false : held;
  }

  public setMoveRight(held: boolean): void {
    this.heldRight = this.isCinematicLocked() ? false : held;
  }

  public setJumpHeld(held: boolean): void {
    if (!held && this.jumpHeld && this.wVy < -65 && !this.wDiveSlamming) {
      this.wVy *= 0.44;
    }
    this.jumpHeld = this.isCinematicLocked() ? false : held;
  }

  public setDownHeld(held: boolean): void {
    if (this.isCinematicLocked()) {
      this.heldDown = false;
      return;
    }
    if (held && !this.heldDown) {
      const floorHere = getBaseFloorYAt(this.wX + 16);
      if (this.wGrounded && this.wY + WARRIOR_FEET_OFFSET < floorHere - 4) {
        this.dropThroughTimer = 0.22;
        this.wGrounded = false;
      } else if (
        !this.wGrounded &&
        !this.wDiveSlamming &&
        this.wY + WARRIOR_FEET_OFFSET < floorHere - 14
      ) {
        this.startDiveSlam();
      }
    }
    this.heldDown = held;
  }

  public triggerJump(): void {
    if (this.isCinematicLocked()) return;
    this.jumpHeld = true;
    this.jumpBuffer = 0.12;
  }

  public triggerAttack(): void {
    if (this.isCinematicLocked()) return;
    if (!this.wGrounded && this.heldDown && !this.wDiveSlamming) {
      this.startDiveSlam();
      return;
    }
    this.attackBuffer = 0.12;
  }

  public triggerParry(): void {
    if (this.isCinematicLocked()) return;
    this.parryBuffer = 0.12;
  }

  public triggerInteractOrParry(): void {
    if (this.isCinematicLocked()) return;
    if (this.tryPickupAnyDrop(38)) return;
    this.parryBuffer = 0.12;
  }

  public triggerInteract(): void {
    if (this.isCinematicLocked()) return;
    this.tryPickupAnyDrop(42);
  }

  public triggerHeal(): void {
    if (this.isCinematicLocked()) return;
    this.healQueued = true;
  }

  public triggerDash(): void {
    if (this.isCinematicLocked()) return;
    this.rollBuffer = 0.12;
  }

  private startDiveSlam(): void {
    this.wDiveSlamming = true;
    this.wAttackTimer = 0;
    this.wRollTimer = 0;
    this.wVy = 470;
    this.wVx *= 0.25;
    sound.playComboSlash(3, false, this.wWeapon);
  }

  private getMaxAirJumps(): number {
    return this.dPhase2Triggered ? 2 : 1; // Triple Jump (1 ground + 2 air) in Phase 2!
  }

  public resetBattle(): void {
    this.clearHeldInputs();
    this.battleElapsed = 0;
    this.battleEnded = false;
    this.pendingWinner = null;
    this.endDelayTimer = 0;
    this.wDeathTimer = 0;

    this.wX = 180;
    this.wY = getBaseFloorYAt(196) - WARRIOR_FEET_OFFSET;
    this.wVx = 0;
    this.wVy = 0;
    this.wFacing = 1;
    this.wGrounded = true;
    this.wCoyoteTimer = 0;
    this.wAirJumpsLeft = 1;
    this.wHp = BATTLE_CONFIG.warriorBaseHp;
    this.wMaxHp = BATTLE_CONFIG.warriorBaseHp;
    this.wShield = 0;
    this.wAwakened = false;
    this.wAwakenedRisen = false;
    this.wAwakeningTimer = 0;
    this.wWeapon = 'broadsword';

    this.weaponDropTimer = BATTLE_CONFIG.weaponDropIntervalSec;
    this.activeDrop = null;
    this.superSkillTimer = BATTLE_CONFIG.superSkillIntervalSec;
    this.activeSkillDrop = null;
    this.lastSuperSkill = null;
    this.activeBuff = null;
    this.activeBuffTimer = 0;
    this.lightningQueue = [];
    this.slashWaves = [];

    this.wComboStep = 0;
    this.wComboWindow = 0;
    this.wAttackTimer = 0;
    this.wAttackCooldown = 0;
    this.wAttackHitDone = false;
    this.wDiveSlamming = false;
    this.wParryTimer = 0;
    this.wParryCooldown = 0;
    this.wHealAnimTimer = 0;
    this.wHealCooldown = 0;
    this.wHealCharges = BATTLE_CONFIG.maxHealCharges;
    this.flameBurnCooldown = 0;
    this.wRollTimer = 0;
    this.wRollCooldown = 0;
    this.wRollDustCount = 0;
    this.wRollBoltDone = false;
    this.wHurtTimer = 0;
    this.wFlashTimer = 0;
    this.wInvulnTimer = 0;
    this.wWalkClock = 0;
    this.dropThroughTimer = 0;
    this.initCloak();

    this.dX = 460;
    this.dY = 172;
    this.dVx = 0;
    this.dVy = 0;
    this.dFacing = -1;
    this.dHp = BATTLE_CONFIG.dragonMaxHp;
    this.dMaxHp = BATTLE_CONFIG.dragonMaxHp;
    this.dAiState = 'reposition_glide';
    this.dAiTimer = 0.42;
    this.dHoverTargetX = 420;
    this.dHoverTargetY = 158;
    this.dLastAttack = '';
    this.dMoveHistory = [];
    this.dQueuedChain = null;
    this.dBlinkAfterMove = 'p2_blink_ambush';
    this.dPhase2Triggered = false;
    this.dFurious = false;
    this.dReactRoared = false;
    this.lastDanceMode = false;
    this.lastDanceTimer = 0;
    this.lastDanceVoicePlayed = false;
    this.lastDanceRoarPlayed = false;
    this.ldZoom = 1;
    this.ldLetterbox = 0;
    this.ldXBeamHitDone = false;
    this.ldSkyTargetX = 320;
    this.ldSawSpinAccum = 0;
    this.ldFinisherStep = 0;
    this.dRecentHits = 0;
    this.dHitDecayTimer = 0;
    this.dPlayerCampTimer = 0;
    this.dPlayerRollSpam = 0;
    this.dPlayerRollDecay = 0;
    this.dDwellTimer = 0;
    this.dDwellAnchorX = 490;
    this.dDwellAnchorY = 195;
    this.dCornerCrowdTimer = 0;
    this.dFlankSide = 1;
    this.dGlideTime = 0;
    this.dReboundTimer = 0;
    this.dRecoverAnchorX = 460;
    this.dVaultTargetX = 240;
    this.dFeintDone = false;
    this.dFakeoutLanded = false;
    this.dTailHitDone = false;
    this.dSwoopHitDone = false;
    this.dDashHitDone = false;
    this.dComboHitIndex = 0;
    this.dComboHitDone = false;
    this.dSpiralPass = 0;
    this.dSpiralHitDone = false;
    this.dBurstRemaining = 0;
    this.dBurstTimer = 0;
    this.dMeteorRemaining = 0;
    this.dMeteorTimer = 0;
    this.dBeamHitDone = false;
    this.dBeamTickTimer = 0;
    this.dFlameDropAccum = 0;
    this.dHurtTimer = 0;
    this.dFlashTimer = 0;

    this.camX = 110;
    this.camY = 58;

    this.shards = [];
    this.flamePatches = [];
    this.flamePillars = [];
    this.emberOrbs = [];
    this.bossWaves = [];
    this.particles = [];
    this.splats = [];
    this.ghosts = [];
    this.wyvernTrails = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.slashSmear.active = false;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;

    this.lastEvent = { type: 'ready' };
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.totalHealed = 0;
    this.attacksLanded = 0;
    this.critsLanded = 0;
    this.parriesLanded = 0;
    this.emitHud();
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      warriorHp: this.wHp,
      warriorMaxHp: this.wMaxHp,
      warriorShield: this.wShield,
      warriorAwakened: this.wAwakened && this.wAwakeningTimer <= 0,
      healCharges: this.wHealCharges,
      maxHealCharges: BATTLE_CONFIG.maxHealCharges,
      dragonHp: this.dHp,
      dragonMaxHp: this.dMaxHp,
      healCooldown: Math.max(0, this.wHealCooldown),
      dashCooldown: Math.max(0, this.wRollCooldown),
      parryCooldown: Math.max(0, this.wParryCooldown),
      comboStep: this.wComboStep,
      weapon: this.wWeapon,
      nextDropIn: Math.max(0, Math.ceil(this.weaponDropTimer)),
      activeDropWeapon: this.activeDrop ? this.activeDrop.weapon : null,
      nextSkillIn: Math.max(0, Math.ceil(this.superSkillTimer)),
      activeSkillDrop: this.activeSkillDrop ? this.activeSkillDrop.skill : null,
      activeBuff: this.activeBuff,
      activeBuffTimer: Math.max(0, this.activeBuffTimer),
      maxJumps: this.getMaxAirJumps() + 1,
      dragonStunned: this.dAiState === 'stunned',
      dragonPhase2: this.dPhase2Triggered,
      dragonFurious: this.dFurious,
      dragonTransforming:
        this.dAiState === 'death_fakeout' ||
        this.dAiState === 'transforming' ||
        this.dAiState === 'dragon_react' ||
        this.dAiState === 'last_dance_charge',
      lastDanceCinematic: this.lastDanceTimer > 0,
      lastDanceBannerActive: this.lastDanceTimer > 0 && this.lastDanceTimer <= 1.85,
      lastDanceMode: this.lastDanceMode,
      lastEvent: this.lastEvent,
    });
  }

  // Tight Dragon CORE hurtbox (excludes massive wing membranes and empty tail gaps)
  private getDragonCoreHurtbox(): Box {
    const coreX = this.dFacing === -1 ? this.dX + 10 : this.dX + (WYVERN_W - 40);
    return {
      x: coreX,
      y: this.dY + 12,
      w: 30,
      h: 32,
    };
  }

  private getDragonCoreCenter(): { x: number; y: number } {
    const b = this.getDragonCoreHurtbox();
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  private getDragonMouthOrChestPos(): { x: number; y: number } {
    return {
      x: this.dFacing === -1 ? this.dX + 14 : this.dX + WYVERN_W - 14,
      y: this.dY + 21,
    };
  }

  private getDragonTailTipPos(): { x: number; y: number } {
    const coiled =
      this.dAiState === 'p1_tail_windup' ||
      this.dAiState === 'p2_tail_windup' ||
      this.dAiState === 'stunned' ||
      this.dHurtTimer > 0;
    if (coiled) {
      return {
        x: this.dFacing === -1 ? this.dX + 70 : this.dX + 10,
        y: this.dY + 5,
      };
    }
    return {
      x: this.dFacing === -1 ? this.dX + 67 : this.dX + 13,
      y: this.dY + 39,
    };
  }

  // Strict close-range melee hitbox aligned strictly with the visual blade/smear
  private getWeaponBladeHitbox(): Box {
    const spec = WEAPON_SPECS[this.wWeapon];
    const extraReach = this.wComboStep === 3 ? 3 : 0;
    const w = spec.reach + extraReach;
    const x = this.wFacing === 1 ? this.wX + 18 : this.wX + 14 - w;
    return {
      x,
      y: this.wY + spec.offsetY,
      w,
      h: spec.height,
    };
  }

  private boxesOverlap(a: Box, b: Box): { x: number; y: number } | null {
    const ox1 = Math.max(a.x, b.x);
    const ox2 = Math.min(a.x + a.w, b.x + b.w);
    const oy1 = Math.max(a.y, b.y);
    const oy2 = Math.min(a.y + a.h, b.y + b.h);
    if (ox1 < ox2 && oy1 < oy2) {
      return { x: (ox1 + ox2) / 2, y: (oy1 + oy2) / 2 };
    }
    return null;
  }

  private stepFixed(dt: number): void {
    if (this.paused) return;
    this.elapsed += dt;

    for (const m of this.forestMotes) {
      m.y -= m.speed * dt;
      m.x += Math.sin(this.elapsed * 1.4 + m.drift) * 6 * dt;
      if (m.y < 54) {
        m.y = BASE_GROUND_Y - 4;
        m.x = Math.random() * WORLD_WIDTH;
      }
    }

    if (this.titleMode) {
      this.camX = 118 + Math.sin(this.elapsed * 0.45) * 42;
      this.camY = 58;
      this.dX = 448 + Math.sin(this.elapsed * 1.1) * 32;
      this.dY = 160 + Math.sin(this.elapsed * 2.2) * 9;
      this.emitWyvernAmbientParticles(dt);
      this.updateParticlesAndVfx(dt);
      this.updateCloak(dt);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    this.updateParticlesAndVfx(dt);

    if (this.battleEnded) {
      this.endDelayTimer -= dt;
      if (this.wHp <= 0) {
        this.wDeathTimer += dt;
        if (this.wDeathTimer > 0.18 && this.wDeathTimer < 0.95 && Math.random() < 0.45) {
          this.particles.push({
            x: this.wX + 16 + (Math.random() - 0.5) * 10,
            y: this.wY + 12 + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 12,
            vy: -24 - Math.random() * 20,
            life: 0.38,
            maxLife: 0.38,
            color: Math.random() < 0.5 ? '#68e3ff' : '#2dd4bf',
            size: 1,
            gravity: -10,
          });
        }
      }
      this.updateCloak(dt);
      this.updateCamera(dt);
      if (this.endDelayTimer <= 0 && this.pendingWinner) {
        const winner = this.pendingWinner;
        this.pendingWinner = null;
        this.callbacks.onBattleEnd({
          winner,
          durationSec: Math.max(1, Math.round(this.battleElapsed)),
          damageDealt: this.damageDealt,
          damageTaken: this.damageTaken,
          totalHealed: this.totalHealed,
          attacksLanded: this.attacksLanded,
          critsLanded: this.critsLanded,
          parriesLanded: this.parriesLanded,
        });
      }
      return;
    }

    this.battleElapsed += dt;

    if (this.wAwakeningTimer > 0) {
      this.updateWarriorAwakeningCinematic(dt);
      this.updateWyvern(dt);
      this.updateCloak(dt);
      this.updateCamera(dt);
      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.06) {
        this.hudSyncAccum = 0;
        this.emitHud();
      }
      return;
    }

    if (this.lastDanceTimer > 0) {
      this.updateLastDanceCinematic(dt);
      this.updateWyvern(dt);
      this.updateCloak(dt);
      this.updateCamera(dt);
      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.05) {
        this.hudSyncAccum = 0;
        this.emitHud();
      }
      return;
    }

    this.updateWeaponDropSystem(dt);
    this.updateSuperSkillSystem(dt);
    this.updateWarrior(dt);
    this.updateSlashWaves(dt);
    this.updateLightningQueue(dt);
    this.updateWyvern(dt);
    this.updateShards(dt);
    this.updateFlamePatches(dt);
    this.updateFlamePillars(dt);
    this.updateEmberOrbs(dt);
    this.updateBossWaves(dt);
    this.emitWyvernAmbientParticles(dt);
    this.updateCloak(dt);
    this.updateCamera(dt);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.08) {
      this.hudSyncAccum = 0;
      this.emitHud();
    }
  }

  private updateWarriorAwakeningCinematic(dt: number): void {
    this.wAwakeningTimer = Math.max(0, this.wAwakeningTimer - dt);

    // Slow-motion collapse to ground
    const floorY = this.findSurfaceBelowWarrior();
    if (!this.wGrounded) {
      this.wVy = Math.min(220, this.wVy + 320 * dt);
      this.wY += this.wVy * dt;
      if (this.wY + WARRIOR_FEET_OFFSET >= floorY) {
        this.wY = floorY - WARRIOR_FEET_OFFSET;
        this.wVy = 0;
        this.wGrounded = true;
      }
    }
    this.wX = Math.max(20, Math.min(WORLD_WIDTH - 52, this.wX + this.wVx * dt));
    this.wVx *= Math.pow(0.05, dt);

    const cx = this.wX + 16;
    const cy = this.wY + 14;

    if (this.wAwakeningTimer > 1.15) {
      // Intense swirling golden-crimson flames around fallen body
      if (Math.random() < 0.85) {
        const ang = this.elapsed * 9 + Math.random() * Math.PI * 2;
        const r = 10 + Math.random() * 14;
        this.pushParticle({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * (r * 0.6),
          vx: -Math.cos(ang) * 28,
          vy: -26 - Math.random() * 26,
          life: 0.32,
          maxLife: 0.32,
          color: Math.random() < 0.5 ? '#FACC15' : '#DC2626',
          size: 2,
          gravity: -20,
        });
      }
    } else {
      if (!this.wAwakenedRisen) {
        this.wAwakenedRisen = true;
        this.wMaxHp = BATTLE_CONFIG.warriorAwakenedHp;
        this.lastEvent = { type: 'warrior_awakening' };
        sound.playWarriorAwakening();
        this.triggerDirectionalShake(0, -1, 6.4, 0.45);
        this.shockwaves.push({
          x: cx,
          y: cy,
          radius: 8,
          maxRadius: 118,
          life: 0.44,
          maxLife: 0.44,
          color: '#FACC15',
        });
        this.spawnInfernalBurst(cx, cy, 34);
        this.emitHud();
      }
      const fillProg = Math.min(1, Math.max(0, 1 - this.wAwakeningTimer / 1.15));
      this.wHp = Math.round(BATTLE_CONFIG.warriorAwakenedHp * fillProg);
      if (Math.random() < 0.65) {
        this.spawnInfernalBurst(cx + (Math.random() - 0.5) * 16, cy, 1);
      }
    }

    if (this.wAwakeningTimer <= 0) {
      this.wHp = BATTLE_CONFIG.warriorAwakenedHp;
      this.wInvulnTimer = 3.2;
      this.clearHeldInputs();
      // Immediately trigger automatic 3-second "THE LAST DANCE" mutual power-gathering standoff!
      this.lastDanceTimer = 3.0;
      this.lastDanceMode = true;
      this.lastDanceVoicePlayed = false;
      this.lastDanceRoarPlayed = false;
      this.dAiState = 'last_dance_charge';
      this.dAiTimer = 3.0;
      this.dQueuedChain = null;
      this.dMoveHistory = [];
      sound.playLastDanceCharge();
      this.emitHud();
    }
  }

  private updateLastDanceCinematic(dt: number): void {
    this.lastDanceTimer = Math.max(0, this.lastDanceTimer - dt);
    const prog = 1 - this.lastDanceTimer / 3.0;

    // Ensure Warrior stands grounded & facing the Dragon across a clear standoff gap
    const floorY = this.findSurfaceBelowWarrior();
    if (!this.wGrounded) {
      this.wVy = Math.min(260, this.wVy + 420 * dt);
      this.wY += this.wVy * dt;
      if (this.wY + WARRIOR_FEET_OFFSET >= floorY) {
        this.wY = floorY - WARRIOR_FEET_OFFSET;
        this.wVy = 0;
        this.wGrounded = true;
      }
    }
    const core = this.getDragonCoreCenter();
    const wCx = this.wX + 16;
    const wCy = this.wY + 13;
    this.wFacing = core.x >= wCx ? 1 : -1;

    // Gentle standoff separation if overlapping so both titans face off clearly
    const dist = Math.abs(core.x - wCx);
    if (dist < 105) {
      const pushDir = wCx <= core.x ? -1 : 1;
      this.wX = Math.max(48, Math.min(WORLD_WIDTH - 80, this.wX + pushDir * 55 * dt));
    }

    // Swirling golden-crimson flames + wind distortion erupting around the Warrior
    if (Math.random() < 0.92) {
      const ang = this.elapsed * (8 + prog * 8) + Math.random() * Math.PI * 2;
      const rad = 14 + (1 - prog * 0.45) * 18;
      this.pushParticle({
        x: wCx + Math.cos(ang) * rad,
        y: wCy + Math.sin(ang) * (rad * 0.55),
        vx: -Math.cos(ang) * 34,
        vy: -32 - Math.random() * (28 + prog * 30),
        life: 0.28 + Math.random() * 0.18,
        maxLife: 0.46,
        color: Math.random() < 0.45 ? '#FACC15' : Math.random() < 0.5 ? '#F97316' : '#DC2626',
        size: Math.random() < 0.45 ? 2 : 1,
        gravity: -24,
      });
    }
    // Wind distortion streaks sweeping across arena
    if (Math.random() < 0.55) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.pushParticle({
        x: (wCx + core.x) * 0.5 + side * (110 + Math.random() * 70),
        y: 120 + Math.random() * 145,
        vx: -side * (160 + prog * 110),
        vy: -14 - Math.random() * 20,
        life: 0.24,
        maxLife: 0.24,
        color: Math.random() < 0.5 ? '#FEF08A' : '#F97316',
        size: 1,
        gravity: -6,
      });
    }

    // Near peak of 3-second charge (~1.35s in): slam "THE LAST DANCE" title + deep gravelly warrior voice!
    if (this.lastDanceTimer <= 1.78 && !this.lastDanceVoicePlayed) {
      this.lastDanceVoicePlayed = true;
      this.lastEvent = { type: 'last_dance' };
      sound.playLastDanceVoice();
      this.triggerDirectionalShake(0, 1, 7.5, 0.48);
      this.shockwaves.push(
        {
          x: wCx,
          y: wCy,
          radius: 8,
          maxRadius: 126,
          life: 0.42,
          maxLife: 0.42,
          color: '#FACC15',
        },
        {
          x: core.x,
          y: core.y,
          radius: 8,
          maxRadius: 138,
          life: 0.42,
          maxLife: 0.42,
          color: '#EF4444',
        }
      );
      this.emitHud();
    }

    // Dragon answers with an earth-shaking furious roar before control returns
    if (this.lastDanceTimer <= 0.62 && !this.lastDanceRoarPlayed) {
      this.lastDanceRoarPlayed = true;
      this.dFurious = true;
      sound.playDragonFuriousRoar();
      this.triggerDirectionalShake(0, -1, 8.8, 0.55);
      this.spawnInfernalBurst(core.x, core.y, 40);
      this.emitHud();
    }

    if (this.lastDanceTimer <= 0) {
      this.dFurious = true;
      this.wInvulnTimer = 0.7;
      this.dAiState = 'recover';
      this.dAiTimer = 0.16;
      this.shockwaves.push({
        x: (wCx + core.x) * 0.5,
        y: (wCy + core.y) * 0.5,
        radius: 14,
        maxRadius: 190,
        life: 0.45,
        maxLife: 0.45,
        color: '#FACC15',
      });
      this.emitHud();
    }
  }

  private pushParticle(p: Particle): void {
    if (this.particles.length >= 220) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  private updateWeaponDropSystem(dt: number): void {
    this.weaponDropTimer -= dt;
    if (this.weaponDropTimer <= 0) {
      this.weaponDropTimer = BATTLE_CONFIG.weaponDropIntervalSec;
      this.spawnRandomWeaponDrop();
    }

    if (this.activeDrop) {
      if (Math.random() < 0.25) {
        this.pushParticle({
          x: this.activeDrop.x + (Math.random() - 0.5) * 14,
          y: this.activeDrop.y - 6 - Math.random() * 16,
          vx: (Math.random() - 0.5) * 8,
          vy: -16 - Math.random() * 14,
          life: 0.35,
          maxLife: 0.35,
          color: Math.random() < 0.5 ? '#66f2ff' : '#ffd147',
          size: 1,
          gravity: -6,
        });
      }
      this.tryPickupWeaponDrop(18);
    }
  }

  private updateSuperSkillSystem(dt: number): void {
    if (this.activeBuffTimer > 0) {
      this.activeBuffTimer = Math.max(0, this.activeBuffTimer - dt);
      if (this.activeBuffTimer <= 0) {
        if (this.activeBuff === 'parry_nova') this.wShield = 0;
        this.activeBuff = null;
      }
    }

    this.superSkillTimer -= dt;
    if (this.superSkillTimer <= 0) {
      this.superSkillTimer = BATTLE_CONFIG.superSkillIntervalSec;
      this.spawnRandomSuperSkillDrop();
    }

    if (this.activeSkillDrop) {
      if (Math.random() < 0.32) {
        this.particles.push({
          x: this.activeSkillDrop.x + (Math.random() - 0.5) * 16,
          y: this.activeSkillDrop.y - 10 - Math.random() * 16,
          vx: (Math.random() - 0.5) * 12,
          vy: -20 - Math.random() * 14,
          life: 0.38,
          maxLife: 0.38,
          color: Math.random() < 0.5 ? '#facc15' : '#c084fc',
          size: 2,
          gravity: -8,
        });
      }
      this.tryPickupSkillDrop(18);
    }
  }

  private spawnRandomWeaponDrop(): void {
    const candidates = WEAPON_LIST.filter(
      (w) => w !== this.wWeapon && (!this.activeDrop || w !== this.activeDrop.weapon)
    );
    const pool = candidates.length > 0 ? candidates : WEAPON_LIST.filter((w) => w !== this.wWeapon);
    const picked = pool[Math.floor(Math.random() * pool.length)];

    const wCenter = this.wX + 16;
    const goodSpots = DROP_SPOTS.filter((s) => Math.abs(s.x - wCenter) > 55);
    const spotPool = goodSpots.length > 0 ? goodSpots : DROP_SPOTS;
    const spot = spotPool[Math.floor(Math.random() * spotPool.length)];

    this.activeDrop = { weapon: picked, x: spot.x, y: spot.y };
    sound.playDropSpawn();
    this.shockwaves.push({
      x: spot.x,
      y: spot.y,
      radius: 4,
      maxRadius: 28,
      life: 0.22,
      maxLife: 0.22,
      color: '#66f2ff',
    });
    this.emitHud();
  }

  private spawnRandomSuperSkillDrop(): void {
    const pool = SUPER_SKILL_LIST.filter((s) => s !== this.lastSuperSkill);
    const picked = pool[Math.floor(Math.random() * pool.length)] ?? SUPER_SKILL_LIST[0];
    this.lastSuperSkill = picked;

    const wCenter = this.wX + 16;
    const goodSpots = DROP_SPOTS.filter(
      (s) => Math.abs(s.x - wCenter) > 40 && (!this.activeDrop || Math.abs(s.x - this.activeDrop.x) > 36)
    );
    const spotPool = goodSpots.length > 0 ? goodSpots : DROP_SPOTS;
    const spot = spotPool[Math.floor(Math.random() * spotPool.length)];

    this.activeSkillDrop = { skill: picked, x: spot.x, y: spot.y };
    sound.playDropSpawn();
    this.shockwaves.push({
      x: spot.x,
      y: spot.y,
      radius: 6,
      maxRadius: 36,
      life: 0.28,
      maxLife: 0.28,
      color: '#facc15',
    });
    this.emitHud();
  }

  private tryPickupAnyDrop(radius: number): boolean {
    const gotSkill = this.tryPickupSkillDrop(radius);
    const gotWeapon = this.tryPickupWeaponDrop(radius);
    return gotSkill || gotWeapon;
  }

  private tryPickupWeaponDrop(radius: number): boolean {
    if (!this.activeDrop) return false;
    const wCenter = this.wX + 16;
    const wFeetY = this.wY + WARRIOR_FEET_OFFSET;
    if (Math.abs(wCenter - this.activeDrop.x) <= radius && Math.abs(wFeetY - this.activeDrop.y) <= 24) {
      const nextWeapon = this.activeDrop.weapon;
      this.wWeapon = nextWeapon;
      this.wComboStep = 0;
      this.wComboWindow = 0;
      this.activeDrop = null;
      this.lastEvent = { type: 'weapon_swap', weapon: nextWeapon };

      sound.playWeaponPickup();
      this.shockwaves.push({
        x: wCenter,
        y: this.wY + 12,
        radius: 4,
        maxRadius: 24,
        life: 0.18,
        maxLife: 0.18,
        color: WEAPON_SPECS[nextWeapon].smearColor,
      });
      this.spawnSlashParticles(wCenter, this.wY + 12, true);
      this.emitHud();
      return true;
    }
    return false;
  }

  private tryPickupSkillDrop(radius: number): boolean {
    if (!this.activeSkillDrop) return false;
    const wCenter = this.wX + 16;
    const wFeetY = this.wY + WARRIOR_FEET_OFFSET;
    if (Math.abs(wCenter - this.activeSkillDrop.x) <= radius && Math.abs(wFeetY - this.activeSkillDrop.y) <= 26) {
      const skill = this.activeSkillDrop.skill;
      this.activeSkillDrop = null;
      this.activateSuperSkill(skill);
      return true;
    }
    return false;
  }

  private activateSuperSkill(skill: SuperSkillType): void {
    const wCenter = this.wX + 16;
    const core = this.getDragonCoreCenter();
    this.lastEvent = { type: 'super_skill', skill };
    sound.playSuperSkillPickup();
    this.shockwaves.push({
      x: wCenter,
      y: this.wY + 12,
      radius: 6,
      maxRadius: 44,
      life: 0.26,
      maxLife: 0.26,
      color: '#facc15',
    });
    this.spawnCrystalBurst(wCenter, this.wY + 12, 16);

    if (skill === 'lightning_dash') {
      this.activeBuff = 'lightning_dash';
      this.activeBuffTimer = 8.0;
      this.wRollCooldown = 0;
      this.lightningQueue = [
        { x: core.x - 16, delay: 0.08, flashLife: 0, struck: false },
        { x: core.x + 14, delay: 0.42, flashLife: 0, struck: false },
        { x: core.x, delay: 0.78, flashLife: 0, struck: false },
      ];
    } else if (skill === 'meteor_slam') {
      this.activeBuff = 'meteor_slam';
      this.activeBuffTimer = 9.0;
      this.shockwaves.push({
        x: wCenter,
        y: this.wY + WARRIOR_FEET_OFFSET,
        radius: 8,
        maxRadius: 68,
        life: 0.3,
        maxLife: 0.3,
        color: '#F97316',
      });
      this.spawnInfernalBurst(wCenter, this.wY + 12, 18);
      if (
        this.dAiState !== 'blink_fade' &&
        this.dAiState !== 'death_fakeout' &&
        this.dAiState !== 'transforming' &&
        Math.hypot(core.x - wCenter, core.y - (this.wY + 12)) <= 76
      ) {
        this.applyDamageToDragon(32, true, this.wFacing, core.x, core.y);
      }
    } else if (skill === 'parry_nova') {
      this.activeBuff = 'parry_nova';
      this.activeBuffTimer = 10.0;
      this.wShield = Math.min(60, this.wShield + 45);
      this.wParryCooldown = 0;
      this.spawnFloatingText(wCenter, this.wY - 6, '+45', '#facc15', 2);
    } else if (skill === 'blade_flurry') {
      this.activeBuff = 'blade_flurry';
      this.activeBuffTimer = 8.0;
      this.wInvulnTimer = Math.max(this.wInvulnTimer, 2.0);
      this.wAttackCooldown = 0;
      for (let i = 0; i < 3; i++) {
        this.slashWaves.push({
          x: wCenter + this.wFacing * (12 + i * 10),
          y: this.wY + 10 + i * 3,
          vx: this.wFacing * (255 + i * 18),
          life: 0.38,
          hitDone: false,
        });
      }
    }

    this.emitHud();
  }

  private updateLightningQueue(dt: number): void {
    const coreBox = this.getDragonCoreHurtbox();
    for (let i = this.lightningQueue.length - 1; i >= 0; i--) {
      const bolt = this.lightningQueue[i];
      if (!bolt.struck) {
        bolt.delay -= dt;
        if (bolt.delay <= 0) {
          bolt.struck = true;
          bolt.flashLife = 0.2;
          sound.playThunderStrike();
          this.triggerDirectionalShake(0, 1, 3.0, 0.15);
          const liveCore = this.getDragonCoreCenter();
          bolt.x = liveCore.x + (Math.random() - 0.5) * 18;
          this.spawnCrystalBurst(bolt.x, liveCore.y, 12);
          if (
            this.dAiState !== 'blink_fade' &&
            this.dAiState !== 'death_fakeout' &&
            this.dAiState !== 'transforming' &&
            Math.abs(bolt.x - (coreBox.x + coreBox.w / 2)) <= 38
          ) {
            this.applyDamageToDragon(24, true, this.wFacing, bolt.x, liveCore.y);
          }
        }
      } else {
        bolt.flashLife -= dt;
        if (bolt.flashLife <= 0) this.lightningQueue.splice(i, 1);
      }
    }
  }

  private updateSlashWaves(dt: number): void {
    const coreBox = this.getDragonCoreHurtbox();
    for (let i = this.slashWaves.length - 1; i >= 0; i--) {
      const sw = this.slashWaves[i];
      sw.life -= dt;
      sw.x += sw.vx * dt;
      if (sw.life <= 0 || sw.x < 10 || sw.x > WORLD_WIDTH - 10) {
        this.slashWaves.splice(i, 1);
        continue;
      }
      if (
        !sw.hitDone &&
        this.dAiState !== 'blink_fade' &&
        this.dAiState !== 'death_fakeout' &&
        this.dAiState !== 'transforming'
      ) {
        const waveBox: Box = { x: sw.x - 6, y: sw.y - 11, w: 12, h: 22 };
        const contact = this.boxesOverlap(waveBox, coreBox);
        if (contact) {
          sw.hitDone = true;
          this.applyDamageToDragon(16, false, sw.vx >= 0 ? 1 : -1, contact.x, contact.y);
          this.slashWaves.splice(i, 1);
        }
      }
    }
  }

  private emitWyvernAmbientParticles(dt: number): void {
    if (this.dAiState === 'defeated') return;

    this.dWingFlakeAccum += dt;
    const flakeRate =
      this.dAiState === 'p1_gust_backstep' ||
      this.dAiState === 'p1_gust_dash' ||
      this.dAiState === 'p1_swoop_dive' ||
      this.dAiState === 'p2_vortex_pull' ||
      this.dAiState === 'p2_spiral_charge'
        ? 0.032
        : 0.12;
    if (this.dWingFlakeAccum >= flakeRate) {
      this.dWingFlakeAccum = 0;
      const wingBackX =
        this.dFacing === -1 ? this.dX + 44 + Math.random() * 24 : this.dX + 10 + Math.random() * 24;
      const wingY = this.dY + 10 + Math.random() * 14;
      const c = this.dPhase2Triggered
        ? Math.random() < 0.6
          ? '#F97316'
          : '#FDE047'
        : Math.random() < 0.65
          ? '#C99A6B'
          : '#683282';
      this.particles.push({
        x: wingBackX,
        y: wingY,
        vx: (Math.random() - 0.5) * 16 - this.dVx * 0.12,
        vy: this.dPhase2Triggered ? -10 - Math.random() * 14 : 14 + Math.random() * 18,
        life: 0.42 + Math.random() * 0.25,
        maxLife: 0.67,
        color: c,
        size: 1,
        gravity: this.dPhase2Triggered ? -14 : 22,
      });
    }

    if (this.dFurious && Math.random() < 0.45) {
      const core = this.getDragonCoreCenter();
      this.pushParticle({
        x: core.x + (Math.random() - 0.5) * 34,
        y: core.y + (Math.random() - 0.5) * 26,
        vx: (Math.random() - 0.5) * 22,
        vy: -28 - Math.random() * 24,
        life: 0.34 + Math.random() * 0.22,
        maxLife: 0.56,
        color: Math.random() < 0.55 ? '#EF4444' : '#FDE047',
        size: Math.random() < 0.35 ? 2 : 1,
        gravity: -16,
      });
    }
    this.dTailSparkAccum += dt;
    const sparkRate = this.dPhase2Triggered || this.dAiState === 'p1_tail_windup' || this.dAiState === 'p2_tail_windup' ? 0.04 : 0.095;
    if (this.dTailSparkAccum >= sparkRate) {
      this.dTailSparkAccum = 0;
      const tailPos = this.getDragonTailTipPos();
      const sparkColor = this.dPhase2Triggered
        ? Math.random() < 0.6
          ? '#FDE047'
          : '#EA580C'
        : Math.random() < 0.65
          ? '#66F2FF'
          : '#FFFFFF';
      this.pushParticle({
        x: tailPos.x + (Math.random() - 0.5) * 4,
        y: tailPos.y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 14,
        vy: -22 - Math.random() * 18,
        life: 0.32 + Math.random() * 0.2,
        maxLife: 0.52,
        color: sparkColor,
        size: 1,
        gravity: -12,
      });
    }
  }

  private updateCamera(dt: number): void {
    const wCenterX = this.wX + 16;
    const dCenter = this.getDragonCoreCenter();
    const dist = Math.abs(dCenter.x - wCenterX);

    if (this.lastDanceTimer > 0) {
      const midX = (wCenterX + dCenter.x) * 0.5 - VIEW_WIDTH / 2;
      const midY = (this.wY + 12 + dCenter.y) * 0.5 - VIEW_HEIGHT * 0.56;
      const clampedX = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, midX));
      const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, midY));
      const smooth = 1 - Math.exp(-8.5 * dt);
      this.camX += (clampedX - this.camX) * smooth;
      this.camY += (clampedY - this.camY) * smooth;
      const prog = 1 - this.lastDanceTimer / 3.0;
      const targetZoom = 1.08 + prog * 0.1;
      this.ldZoom += (targetZoom - this.ldZoom) * Math.min(1, 6 * dt);
      this.ldLetterbox += (1 - this.ldLetterbox) * Math.min(1, 8 * dt);
      return;
    }

    this.ldZoom += (1 - this.ldZoom) * Math.min(1, 9 * dt);
    this.ldLetterbox += (0 - this.ldLetterbox) * Math.min(1, 9 * dt);

    let targetX = wCenterX + this.wFacing * 44 - VIEW_WIDTH / 2;
    if (dist < 280) {
      const midX = wCenterX * 0.58 + dCenter.x * 0.42 - VIEW_WIDTH / 2;
      targetX = targetX * 0.4 + midX * 0.6;
    }
    const targetY = this.wY + 12 - VIEW_HEIGHT * 0.68;

    const clampedX = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, targetX));
    const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, targetY));

    const smoothX = 1 - Math.exp(-10.5 * dt);
    const smoothY = 1 - Math.exp(-7.2 * dt);
    this.camX += (clampedX - this.camX) * smoothX;
    this.camY += (clampedY - this.camY) * smoothY;
  }

  private updateCloak(dt: number): void {
    const anchorX = this.wX + (this.wFacing === 1 ? 12 : 20);
    const anchorY = this.wY + 13;
    if (this.cloakNodes.length === 0) return;

    this.cloakNodes[0].x = anchorX;
    this.cloakNodes[0].y = anchorY;

    const windX = -this.wFacing * 20 + Math.sin(this.elapsed * 9) * 7;
    const segLen = 2.6;

    for (let i = 1; i < this.cloakNodes.length; i++) {
      const prev = this.cloakNodes[i - 1];
      const cur = this.cloakNodes[i];

      cur.x += windX * dt;
      cur.y += (26 + Math.cos(this.elapsed * 11 + i) * 12) * dt;

      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist > segLen) {
        cur.x = prev.x + (dx / dist) * segLen;
        cur.y = prev.y + (dy / dist) * segLen;
      }
    }
  }

  private triggerDirectionalShake(dirX: number, dirY: number, mag: number, duration: number): void {
    this.shakeDirX = dirX;
    this.shakeDirY = dirY;
    this.shakeMagnitude = mag;
    this.shakeTimer = duration;
  }

  private updateWarrior(dt: number): void {
    if (this.wFlashTimer > 0) this.wFlashTimer = Math.max(0, this.wFlashTimer - dt);
    if (this.wHurtTimer > 0) this.wHurtTimer = Math.max(0, this.wHurtTimer - dt);
    if (this.wInvulnTimer > 0) this.wInvulnTimer = Math.max(0, this.wInvulnTimer - dt);
    if (this.wAttackCooldown > 0) this.wAttackCooldown = Math.max(0, this.wAttackCooldown - dt);
    if (this.wComboWindow > 0) {
      this.wComboWindow = Math.max(0, this.wComboWindow - dt);
      if (this.wComboWindow <= 0) this.wComboStep = 0;
    }
    if (this.wParryTimer > 0) this.wParryTimer = Math.max(0, this.wParryTimer - dt);
    if (this.wParryCooldown > 0) this.wParryCooldown = Math.max(0, this.wParryCooldown - dt);
    if (this.wHealCooldown > 0) this.wHealCooldown = Math.max(0, this.wHealCooldown - dt);
    if (this.wRollCooldown > 0) this.wRollCooldown = Math.max(0, this.wRollCooldown - dt);
    if (this.wHealAnimTimer > 0) this.wHealAnimTimer = Math.max(0, this.wHealAnimTimer - dt);
    if (this.dropThroughTimer > 0) this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);

    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.rollBuffer > 0) this.rollBuffer = Math.max(0, this.rollBuffer - dt);
    if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    if (this.parryBuffer > 0) this.parryBuffer = Math.max(0, this.parryBuffer - dt);

    if (this.wGrounded) {
      this.wCoyoteTimer = 0.1;
      this.wAirJumpsLeft = this.getMaxAirJumps();
    } else if (this.wCoyoteTimer > 0) {
      this.wCoyoteTimer = Math.max(0, this.wCoyoteTimer - dt);
    }

    if (this.flameBurnCooldown > 0) this.flameBurnCooldown = Math.max(0, this.flameBurnCooldown - dt);

    if (this.rollBuffer > 0 && this.wRollCooldown <= 0 && this.wRollTimer <= 0 && !this.wDiveSlamming) {
      this.rollBuffer = 0;
      this.wAttackTimer = 0;
      this.wParryTimer = 0;
      this.wRollTimer = 0.21;
      this.wRollCooldown =
        this.activeBuff === 'lightning_dash' ? 0.36 : BATTLE_CONFIG.dashCooldownSec;
      this.wInvulnTimer = Math.max(this.wInvulnTimer, 0.24);
      this.wGhostSpawnAccum = 0;
      this.wRollDustCount = 3;
      this.wRollBoltDone = false;

      const moveDir = (this.heldRight ? 1 : 0) - (this.heldLeft ? 1 : 0);
      if (moveDir !== 0) this.wFacing = moveDir > 0 ? 1 : -1;
      this.wVx = this.wFacing * (this.activeBuff === 'lightning_dash' ? 310 : 280);
      sound.playDash();
      this.spawnWhiteRollPuff(this.wX + 16, this.wY + 21);

      // Souls-like AI telemetry: track player roll spam near dragon
      const dCore = this.getDragonCoreCenter();
      if (Math.abs(this.wX + 16 - dCore.x) < 130) {
        this.dPlayerRollSpam += 1;
        this.dPlayerRollDecay = 2.0;
      }
    }

    if (this.jumpBuffer > 0 && (this.wCoyoteTimer > 0 || this.wAirJumpsLeft > 0) && !this.wDiveSlamming) {
      const fromGround = this.wCoyoteTimer > 0;
      this.jumpBuffer = 0;
      this.wCoyoteTimer = 0;
      const maxAir = this.getMaxAirJumps();
      let jumpIndex = 1;
      if (!fromGround) {
        jumpIndex = maxAir - this.wAirJumpsLeft + 2;
        this.wAirJumpsLeft -= 1;
      }
      this.wAttackTimer = 0;
      this.wRollTimer = 0;
      this.wGrounded = false;
      this.wVy = jumpIndex === 3 ? -240 : jumpIndex === 2 ? -228 : -252;
      sound.playJump(jumpIndex);

      if (jumpIndex === 3) {
        this.shockwaves.push({
          x: this.wX + 16,
          y: this.wY + WARRIOR_FEET_OFFSET,
          radius: 4,
          maxRadius: 20,
          life: 0.16,
          maxLife: 0.16,
          color: '#facc15',
        });
      }
      this.spawnDustBurst(
        this.wX + 16,
        this.wY + WARRIOR_FEET_OFFSET,
        jumpIndex === 3 ? '#facc15' : jumpIndex === 2 ? '#f8fafc' : '#8cf274'
      );
    }

    if (this.parryBuffer > 0 && this.wParryCooldown <= 0 && this.wRollTimer <= 0 && !this.wDiveSlamming) {
      this.parryBuffer = 0;
      this.wAttackTimer = 0;
      this.wParryTimer = 0.28;
      this.wParryCooldown = BATTLE_CONFIG.parryCooldownSec;
      sound.playUiTick();
    }

    if (this.healQueued) {
      this.healQueued = false;
      if (this.wHealCharges <= 0 || this.wHp >= this.wMaxHp) {
        sound.playEmptyClick();
      } else if (this.wHealCooldown <= 0 && this.wRollTimer <= 0) {
        this.wHealCharges -= 1;
        this.wHealCooldown = BATTLE_CONFIG.healCooldownSec;
        this.wHealAnimTimer = 0.42;
        const prevHp = this.wHp;
        this.wHp = Math.min(this.wMaxHp, this.wHp + BATTLE_CONFIG.warriorHeal);
        const gained = this.wHp - prevHp;
        this.totalHealed += gained;
        this.lastEvent = { type: 'warrior_heal', hp: this.wHp, chargesLeft: this.wHealCharges };
        sound.playHealChime();
        this.spawnHealParticles(this.wX + 16, this.wY + 14);
        this.spawnFloatingText(
          this.wX + 16,
          this.wY - 2,
          `+${gained}`,
          '#34d399',
          2
        );
        this.emitHud();
      }
    }

    // Attack cancels roll cleanly for extra fluid combat!
    if (
      this.attackBuffer > 0 &&
      this.wAttackCooldown <= 0 &&
      this.wParryTimer <= 0 &&
      !this.wDiveSlamming
    ) {
      this.attackBuffer = 0;
      this.wRollTimer = 0;
      this.wComboStep = this.wComboWindow > 0 ? (this.wComboStep % 3) + 1 : 1;
      this.wComboWindow = 0.54;

      const spec = WEAPON_SPECS[this.wWeapon];
      const idx = this.wComboStep - 1;
      const haste = this.activeBuff === 'blade_flurry' ? 0.72 : 1.0;
      this.wAttackDuration = spec.durations[idx] * haste;
      this.wAttackTimer = this.wAttackDuration;
      this.wAttackCooldown = spec.cooldowns[idx] * haste;
      this.wAttackHitDone = false;

      const moveDir = (this.heldRight ? 1 : 0) - (this.heldLeft ? 1 : 0);
      if (moveDir !== 0) this.wFacing = moveDir > 0 ? 1 : -1;

      this.wVx = this.wFacing * (this.wComboStep === 3 ? 82 : 48);
      sound.playComboSlash(this.wComboStep, false, this.wWeapon);

      if (this.activeBuff === 'meteor_slam' || this.activeBuff === 'blade_flurry') {
        this.slashWaves.push({
          x: this.wX + 16 + this.wFacing * 14,
          y: this.wY + 14,
          vx: this.wFacing * 255,
          life: 0.34,
          hitDone: false,
        });
      }

      const slashX = this.wFacing === 1 ? this.wX + 20 : this.wX + 12;
      this.slashSmear = {
        active: true,
        x: slashX,
        y: this.wY + 14,
        facing: this.wFacing,
        comboStep: this.wComboStep,
        weapon: this.wWeapon,
        isCrit: false,
        life: 0.14,
        maxLife: 0.14,
      };
    }

    if (this.wRollTimer > 0) {
      this.wRollTimer -= dt;
      if (this.activeBuff === 'lightning_dash' && !this.wRollBoltDone) {
        const wBox: Box = { x: this.wX + 4, y: this.wY + 2, w: 24, h: 24 };
        const coreBox = this.getDragonCoreHurtbox();
        const hit = this.boxesOverlap(wBox, coreBox);
        if (hit && this.dAiState !== 'blink_fade' && this.dAiState !== 'death_fakeout' && this.dAiState !== 'transforming') {
          this.wRollBoltDone = true;
          sound.playThunderStrike();
          this.applyDamageToDragon(22, true, this.wFacing, hit.x, hit.y);
        }
      }

      this.wGhostSpawnAccum += dt;
      if (this.wGhostSpawnAccum >= 0.032) {
        this.wGhostSpawnAccum = 0;
        const frame = Math.floor(this.elapsed * 26) % 2;
        this.ghosts.push({
          x: this.wX,
          y: this.wY,
          facing: this.wFacing,
          frame,
          life: 0.16,
          maxLife: 0.16,
        });
        if (this.wRollDustCount > 0) {
          this.wRollDustCount -= 1;
          this.spawnWhiteRollPuff(this.wX + 16 - this.wFacing * 6, this.wY + 21);
        }
      }
    } else if (!this.wDiveSlamming && this.wAttackTimer <= 0) {
      const moveDir = (this.heldRight ? 1 : 0) - (this.heldLeft ? 1 : 0);
      const speedBonus = this.activeBuff === 'lightning_dash' ? 32 : 0;
      const maxSpeed = 148 + speedBonus;
      if (moveDir !== 0 && this.wHurtTimer <= 0.1) {
        this.wFacing = moveDir > 0 ? 1 : -1;
        const accel = this.wGrounded ? 2900 : 2100;
        this.wVx += moveDir * accel * dt;
        if (Math.abs(this.wVx) > maxSpeed) this.wVx = moveDir * maxSpeed;
        if (this.wGrounded) this.wWalkClock += dt * 13.5;
      } else {
        const decel = this.wGrounded ? 4200 : 1600;
        if (Math.abs(this.wVx) <= decel * dt) {
          this.wVx = 0;
        } else {
          this.wVx -= Math.sign(this.wVx) * decel * dt;
        }
      }
    }

    const prevFeetY = this.wY + WARRIOR_FEET_OFFSET;
    const wasGrounded = this.wGrounded;
    if (!this.wDiveSlamming) {
      const grav = this.wVy > 0 ? 730 : 610;
      this.wVy = Math.min(395, this.wVy + grav * dt);
    }
    this.wX += this.wVx * dt;
    this.wY += this.wVy * dt;

    if (this.wX < 20) this.wX = 20;
    if (this.wX > WORLD_WIDTH - 52) this.wX = WORLD_WIDTH - 52;

    const feetXCenter = this.wX + 16;
    const feetY = this.wY + WARRIOR_FEET_OFFSET;
    let landedPlatform: Platform | null = null;

    if (this.wVy >= 0) {
      for (const plat of PLATFORMS) {
        if (plat.oneWay && this.dropThroughTimer > 0 && !this.wDiveSlamming) continue;
        const withinX = feetXCenter >= plat.x - 5 && feetXCenter <= plat.x + plat.w + 5;
        const stepAllowance = !plat.oneWay && wasGrounded ? 9 : 4;
        if (withinX && prevFeetY <= plat.y + stepAllowance && feetY >= plat.y) {
          landedPlatform = plat;
          break;
        }
      }
    }

    // Auto-ledge grab/vault on elevated platforms
    if (!landedPlatform && !this.wGrounded && !this.wDiveSlamming && this.wVy > -120) {
      for (const plat of PLATFORMS) {
        if (!plat.oneWay) continue;
        const nearY = feetY >= plat.y - 6 && feetY <= plat.y + 10;
        const nearLeftLedge =
          this.wFacing === 1 && this.heldRight && feetXCenter >= plat.x - 12 && feetXCenter <= plat.x + 8;
        const nearRightLedge =
          this.wFacing === -1 && this.heldLeft && feetXCenter >= plat.x + plat.w - 8 && feetXCenter <= plat.x + plat.w + 12;

        if (nearY && (nearLeftLedge || nearRightLedge)) {
          this.wY = plat.y - WARRIOR_FEET_OFFSET;
          this.wX = nearLeftLedge ? plat.x - 10 : plat.x + plat.w - 22;
          this.wVy = 0;
          this.wGrounded = true;
          this.wAirJumpsLeft = this.getMaxAirJumps();
          this.spawnDustBurst(this.wX + 16, plat.y, '#8cf274');
          landedPlatform = plat;
          break;
        }
      }
    }

    if (landedPlatform) {
      const wasDive = this.wDiveSlamming;
      this.wY = landedPlatform.y - WARRIOR_FEET_OFFSET;
      this.wVy = 0;
      this.wGrounded = true;
      this.wDiveSlamming = false;
      if (wasDive) this.resolveDiveSlamImpact(landedPlatform.y);
    } else {
      this.wGrounded = false;
    }

    if (this.wAwakened && !this.battleEnded && Math.random() < 0.48) {
      this.pushParticle({
        x: this.wX + 16 + (Math.random() - 0.5) * 18,
        y: this.wY + 8 + Math.random() * 14,
        vx: (Math.random() - 0.5) * 16,
        vy: -24 - Math.random() * 20,
        life: 0.28,
        maxLife: 0.28,
        color: Math.random() < 0.5 ? '#FACC15' : '#F97316',
        size: 1,
        gravity: -16,
      });
    }

    // STRICT CLOSE-RANGE MELEE HITBOX CHECK
    if (this.wAttackTimer > 0) {
      this.wAttackTimer = Math.max(0, this.wAttackTimer - dt);
      const inHitWindow =
        this.wAttackTimer <= this.wAttackDuration * 0.86 &&
        this.wAttackTimer >= this.wAttackDuration * 0.24;

      if (
        !this.wAttackHitDone &&
        inHitWindow &&
        this.dAiState !== 'blink_fade' &&
        this.dAiState !== 'death_fakeout' &&
        this.dAiState !== 'transforming' &&
        this.dAiState !== 'dragon_react'
      ) {
        const bladeBox = this.getWeaponBladeHitbox();
        const coreBox = this.getDragonCoreHurtbox();
        const contact = this.boxesOverlap(bladeBox, coreBox);
        if (contact) {
          this.wAttackHitDone = true;
          this.resolveWarriorHitDragon(contact.x, contact.y);
        }
      }
    }

    if (this.slashSmear.active) {
      this.slashSmear.life -= dt;
      if (this.slashSmear.life <= 0) this.slashSmear.active = false;
    }
  }

  private resolveDiveSlamImpact(surfaceY: number): void {
    const isMeteor = this.activeBuff === 'meteor_slam';
    sound.playDiveSlam();
    this.triggerDirectionalShake(0, 1, isMeteor ? 5.2 : 4.0, 0.24);
    this.shockwaves.push({
      x: this.wX + 16,
      y: surfaceY,
      radius: 8,
      maxRadius: isMeteor ? 78 : 54,
      life: 0.28,
      maxLife: 0.28,
      color: isMeteor ? '#F97316' : '#ffd147',
    });
    if (isMeteor || this.wAwakened) this.spawnInfernalBurst(this.wX + 16, surfaceY - 4, 18);
    else this.spawnDustBurst(this.wX + 16, surfaceY, '#8cf274');

    const wCenter = this.wX + 16;
    const core = this.getDragonCoreHurtbox();
    const coreCenterX = core.x + core.w / 2;
    const coreBottomY = core.y + core.h;
    if (
      this.dAiState !== 'blink_fade' &&
      this.dAiState !== 'death_fakeout' &&
      this.dAiState !== 'transforming' &&
      this.dAiState !== 'dragon_react' &&
      Math.abs(wCenter - coreCenterX) <= (isMeteor ? 54 : 34) &&
      Math.abs(coreBottomY - surfaceY) <= (isMeteor ? 48 : 36)
    ) {
      const baseSlam = isMeteor ? 55 : 32;
      this.applyDamageToDragon(
        this.wAwakened ? Math.round(baseSlam * 1.35) : baseSlam,
        true,
        wCenter < coreCenterX ? 1 : -1,
        coreCenterX,
        core.y + core.h / 2
      );
    }
  }

  private resolveWarriorHitDragon(contactX: number, contactY: number): void {
    const wCenter = this.wX + 16;
    const coreCenter = this.getDragonCoreCenter();
    const strikeDir: 1 | -1 = this.wFacing;
    const spec = WEAPON_SPECS[this.wWeapon];

    const isBackstab =
      (this.dFacing === 1 && wCenter < coreCenter.x - 4) ||
      (this.dFacing === -1 && wCenter > coreCenter.x + 4);
    const isAirborne = !this.wGrounded;
    const isStunned = this.dAiState === 'stunned';
    const isSpearTip = this.wWeapon === 'spear' && Math.abs(wCenter - coreCenter.x) >= 24;
    const isCrit = isBackstab || isAirborne || isStunned || isSpearTip || this.wComboStep === 3;

    const baseDmg = spec.baseDmg[Math.max(0, this.wComboStep - 1)];
    const critDmg = isCrit ? Math.round(baseDmg * spec.critMult) : baseDmg;
    const finalDmg = this.wAwakened ? Math.round(critDmg * 1.35) : critDmg;

    this.slashSmear.isCrit = isCrit;
    this.applyDamageToDragon(finalDmg, isCrit, strikeDir, contactX, contactY);
  }

  private applyDamageToDragon(
    amount: number,
    isCrit: boolean,
    dir: number,
    contactX?: number,
    contactY?: number
  ): void {
    if (
      this.battleEnded ||
      this.dAiState === 'death_fakeout' ||
      this.dAiState === 'transforming' ||
      this.dAiState === 'dragon_react'
    ) {
      return;
    }
    const core = this.getDragonCoreCenter();
    const hitX = contactX ?? core.x;
    const hitY = contactY ?? core.y;

    this.dHp = Math.max(0, this.dHp - amount);
    this.damageDealt += amount;
    this.attacksLanded += 1;
    if (isCrit) this.critsLanded += 1;
    this.lastEvent = { type: 'warrior_attack', hp: this.dHp, dmg: amount, crit: isCrit };

    this.dRecentHits += 1;
    this.dHitDecayTimer = 1.6;

    // Realistic weapon-specific impact sound + fierce dragon screech on burst/crits
    sound.playWeaponHit(this.wWeapon, isCrit);
    if (isCrit && Math.random() < 0.55) {
      sound.playDragonScreech(this.dPhase2Triggered);
    }

    this.dFlashTimer = 0.08;
    this.dHurtTimer = 0.16;
    const baseKb = WEAPON_SPECS[this.wWeapon].knockback;
    const kb = isCrit ? baseKb + 4 : baseKb;
    const stationaryAttack =
      this.dAiState === 'p1_swoop_dive' ||
      this.dAiState === 'p1_beam_sweep' ||
      this.dAiState === 'p2_beam_sweep' ||
      this.dAiState === 'p2_spiral_charge' ||
      this.dAiState === 'p2_slam_drop';
    if (!stationaryAttack) {
      this.dX = Math.max(20, Math.min(WORLD_WIDTH - WYVERN_W - 20, this.dX + dir * kb));
    }

    this.hitstopTimer = isCrit ? 0.056 : 0.036;
    this.triggerDirectionalShake(dir, isCrit ? 0.45 : 0.2, isCrit ? 4.4 : 2.5, isCrit ? 0.22 : 0.14);

    if (this.wAwakened) this.spawnInfernalBurst(hitX, hitY, isCrit ? 14 : 9);
    else this.spawnSlashParticles(hitX, hitY, isCrit);
    this.spawnFloatingText(
      hitX,
      hitY - 14,
      isCrit ? `${amount}!` : `-${amount}`,
      isCrit ? '#ffd147' : '#ffffff',
      isCrit ? 3 : 2
    );

    // Phase 1 HP reaches 0 -> Trigger Ground Crash Death Fake-Out -> Awakening -> Massive Explosion -> 1500 HP Phase 2!
    if (!this.dPhase2Triggered && this.dHp <= 0) {
      this.dHp = 0;
      this.dAiState = 'death_fakeout';
      this.dAiTimer = 1.95;
      this.dFakeoutLanded = false;
      this.dVx = 0;
      this.dVy = 70;
      this.dQueuedChain = null;
      this.shards = [];
      this.lastEvent = { type: 'dragon_fakeout' };
      sound.playDeathFakeoutCollapse();
      this.triggerDirectionalShake(0, 1, 3.8, 0.35);
      this.spawnCrystalBurst(core.x, core.y, 26);
      this.emitHud();
      return;
    }

    this.emitHud();

    // True Death only after Phase 2 1500 HP is depleted!
    if (this.dPhase2Triggered && this.dHp <= 0) {
      this.dAiState = 'defeated';
      this.dVx = 0;
      this.dVy = 0;
      this.battleEnded = true;
      this.pendingWinner = 'warrior';
      this.endDelayTimer = 1.25;
      sound.playVictory();
      this.spawnInfernalBurst(core.x, core.y, 40);
    }
  }

  private triggerParrySuccess(stunWyvern: boolean): void {
    const isParryNova = this.activeBuff === 'parry_nova';
    this.wParryTimer = 0;
    this.wParryCooldown = 0;
    this.wAttackCooldown = 0;
    this.wInvulnTimer = Math.max(this.wInvulnTimer, 0.4);
    this.parriesLanded += 1;
    this.lastEvent = { type: 'warrior_parry' };

    sound.playParryClang();
    this.hitstopTimer = 0.062;
    this.triggerDirectionalShake(this.wFacing, 0, isParryNova ? 5.2 : 4.0, 0.2);

    const sparkX = this.wX + 16 + this.wFacing * 10;
    const sparkY = this.wY + 13;
    this.shockwaves.push({
      x: sparkX,
      y: sparkY,
      radius: 4,
      maxRadius: isParryNova ? 64 : 34,
      life: 0.22,
      maxLife: 0.22,
      color: isParryNova ? '#F97316' : '#ffd147',
    });
    if (isParryNova) this.spawnInfernalBurst(sparkX, sparkY, 20);
    else this.spawnSlashParticles(sparkX, sparkY, true);

    const counterDmg = isParryNova ? 44 : 20;
    this.spawnFloatingText(this.wX + 16, this.wY - 8, `${counterDmg}!`, '#66F2FF', 2);

    if (
      (stunWyvern || isParryNova) &&
      this.dAiState !== 'defeated' &&
      this.dAiState !== 'death_fakeout' &&
      this.dAiState !== 'transforming'
    ) {
      this.dAiState = 'stunned';
      this.dAiTimer = 1.5;
      this.dQueuedChain = null;
      this.dVx = -this.dFacing * 72;
      this.dVy = 0;
      const core = this.getDragonCoreCenter();
      this.applyDamageToDragon(counterDmg, true, this.wFacing, core.x, core.y);
    }
    this.emitHud();
  }

  private damageWarrior(
    amount: number,
    knockDir: number,
    parryStunsWyvern = false,
    invulnOverride = 0.85
  ): void {
    if (this.battleEnded) return;

    if (this.wParryTimer > 0) {
      this.triggerParrySuccess(parryStunsWyvern);
      return;
    }

    if (this.wInvulnTimer > 0) return;

    // Parry Nova shield barrier absorbs damage first!
    let remaining = amount;
    if (this.wShield > 0) {
      const absorbed = Math.min(this.wShield, remaining);
      this.wShield -= absorbed;
      remaining -= absorbed;
      this.spawnFloatingText(this.wX + 16, this.wY - 8, `-${absorbed}`, '#facc15', 2);
      if (this.wShield <= 0 && this.activeBuff === 'parry_nova') {
        this.activeBuff = null;
        this.activeBuffTimer = 0;
      }
    }

    if (remaining > 0) {
      this.wHp = Math.max(0, this.wHp - remaining);
      this.damageTaken += remaining;
      this.lastEvent = { type: 'dragon_attack', hp: this.wHp, dmg: remaining };
      this.spawnFloatingText(this.wX + 16, this.wY - 4, `-${remaining}`, '#ff5c5c', 2);
    }

    sound.playHitImpact(this.dPhase2Triggered);
    this.wFlashTimer = 0.12;
    this.wHurtTimer = 0.2;
    this.wInvulnTimer = invulnOverride;
    this.wAttackTimer = 0;
    this.wDiveSlamming = false;
    this.wVx = knockDir * (invulnOverride < 0.5 ? 78 : 132);
    if (this.wGrounded) {
      this.wVy = invulnOverride < 0.5 ? -75 : -116;
      this.wGrounded = false;
    }

    this.hitstopTimer = 0.045;
    this.triggerDirectionalShake(knockDir, 0.4, 3.8, 0.22);

    if (this.dPhase2Triggered) {
      this.spawnInfernalBurst(this.wX + 16, this.wY + 12, 12);
    } else {
      this.spawnCrystalBurst(this.wX + 16, this.wY + 12, 12);
    }
    this.emitHud();

    if (this.wHp <= 0) {
      // Warrior Phase 2 Death -> One-time Cinematic Flame Awakening (500 HP) + Dragon Furious Reaction!
      if (this.dPhase2Triggered && !this.wAwakened) {
        this.wHp = 0;
        this.wAwakened = true;
        this.wAwakenedRisen = false;
        this.wAwakeningTimer = 2.0;
        this.wInvulnTimer = 2.6;
        this.wAttackTimer = 0;
        this.wRollTimer = 0;
        this.wParryTimer = 0;
        this.wDiveSlamming = false;
        this.wVx = -knockDir * 40;

        this.shards = [];
        this.flamePillars = [];
        this.emberOrbs = [];
        this.bossWaves = [];

        this.dAiState = 'dragon_react';
        this.dAiTimer = 2.55;
        this.dReactRoared = false;
        this.dVx = 0;
        this.dVy = 0;
        this.dQueuedChain = null;

        sound.playDeathFakeoutCollapse();
        this.emitHud();
        return;
      }

      this.battleEnded = true;
      this.pendingWinner = 'dragon';
      this.wDeathTimer = 0;
      this.endDelayTimer = 1.15;
      sound.playDefeat();
      this.spawnDustBurst(this.wX + 16, this.wY + WARRIOR_FEET_OFFSET, '#68e3ff');
    }
  }

  private recordMoveHistory(move: WyvernAiState): void {
    this.dLastAttack = move;
    this.dMoveHistory.push(move);
    if (this.dMoveHistory.length > 3) {
      this.dMoveHistory.shift();
    }
  }

  private beginWyvernMove(pick: WyvernAiState): void {
    const wCenterX = this.wX + 16;
    const core = this.getDragonCoreCenter();
    const dx = wCenterX - core.x;
    const enraged = this.dPhase2Triggered;
    const spd = this.lastDanceMode ? 1.48 : this.dFurious ? 1.22 : 1.0;

    this.recordMoveHistory(pick);
    this.dFacing = dx >= 0 ? 1 : -1;
    this.dVx = 0;
    this.dVy = 0;

    if (pick === 'p1_swoop_windup') {
      this.dAiState = 'p1_swoop_windup';
      this.dAiTimer = 0.46 + Math.random() * 0.24;
      this.dFeintDone = false;
      this.dSwoopHitDone = false;
      sound.playWyvernTelegraph('swoop', false);
    } else if (pick === 'p1_tail_windup') {
      this.dAiState = 'p1_tail_windup';
      this.dAiTimer = Math.random() < 0.55 ? 0.74 : 0.38;
      this.dTailHitDone = false;
      sound.playWyvernTelegraph('tail', false);
    } else if (pick === 'p1_shard_volley') {
      this.dAiState = 'p1_shard_volley';
      this.dAiTimer = 0.44;
      this.dBurstRemaining = 4;
      this.dBurstTimer = 0;
      sound.playWyvernTelegraph('crystal', false);
    } else if (pick === 'p1_gust_backstep') {
      this.dAiState = 'p1_gust_backstep';
      this.dAiTimer = 0.34;
      this.dDashHitDone = false;
      sound.playWingGust();
      sound.playDragonSnarl(false);
      this.triggerDirectionalShake(-this.dFacing, 0, 2.8, 0.16);
      for (let i = 0; i < 12; i++) {
        this.pushParticle({
          x: core.x + (Math.random() - 0.5) * 26,
          y: core.y + (Math.random() - 0.5) * 18,
          vx: (wCenterX >= core.x ? 1 : -1) * (85 + Math.random() * 85),
          vy: (Math.random() - 0.5) * 40,
          life: 0.32,
          maxLife: 0.32,
          color: i % 2 === 0 ? '#C99A6B' : '#66F2FF',
          size: 2,
          gravity: 25,
        });
      }
      if (Math.abs(wCenterX - core.x) < 145 && this.wRollTimer <= 0) {
        this.wVx += (wCenterX >= core.x ? 1 : -1) * 185;
      }
      this.dVx = -this.dFacing * 155;
    } else if (pick === 'p1_beam_windup') {
      this.dAiState = 'p1_beam_windup';
      this.dAiTimer = 0.66;
      this.dBeamHitDone = false;
      const mouth = this.getDragonMouthOrChestPos();
      const baseAngle = Math.atan2(this.wY + 12 - mouth.y, wCenterX - mouth.x);
      const sweepDir = Math.random() < 0.5 ? 1 : -1;
      this.dBeamStartAngle = baseAngle - sweepDir * 0.45;
      this.dBeamEndAngle = baseAngle + sweepDir * 0.55;
      this.dBeamCurrentAngle = this.dBeamStartAngle;
      sound.playWyvernTelegraph('crystal', false);
    } else if (pick === 'p2_combo_windup') {
      this.dAiState = 'p2_combo_windup';
      this.dComboHitIndex = 0;
      this.dComboHitDone = false;
      this.dAiTimer = 0.28 / spd;
      sound.playWyvernTelegraph('swoop', true);
    } else if (pick === 'p2_beam_windup') {
      this.dAiState = 'p2_beam_windup';
      this.dAiTimer = 0.54 / spd;
      this.dBeamHitDone = false;
      this.dBeamTickTimer = 0;
      this.dFlameDropAccum = 0;
      const mouth = this.getDragonMouthOrChestPos();
      const baseAngle = Math.atan2(this.wY + 12 - mouth.y, wCenterX - mouth.x);
      const sweepDir = Math.random() < 0.5 ? 1 : -1;
      this.dBeamStartAngle = baseAngle - sweepDir * 0.78;
      this.dBeamEndAngle = baseAngle + sweepDir * 0.92;
      this.dBeamCurrentAngle = this.dBeamStartAngle;
      sound.playWyvernTelegraph('crystal', true);
    } else if (pick === 'p2_feint_blink') {
      this.dAiState = 'p2_feint_blink';
      this.dAiTimer = 0.44 / spd;
      this.dBlinkAfterMove = 'p2_blink_ambush';
      this.dSwoopHitDone = false;
      sound.playWyvernTelegraph('swoop', true);
    } else if (pick === 'p2_meteor_barrage') {
      this.dAiState = 'p2_meteor_barrage';
      this.dAiTimer = 0.34 / spd;
      this.dMeteorRemaining = this.lastDanceMode ? 8 : 6;
      this.dMeteorTimer = 0;
      sound.playWyvernTelegraph('crystal', true);
    } else if (pick === 'p2_tail_windup') {
      this.dAiState = 'p2_tail_windup';
      this.dAiTimer = (Math.random() < 0.5 ? 0.6 : 0.3) / spd;
      this.dTailHitDone = false;
      sound.playWyvernTelegraph('tail', true);
    } else if (pick === 'p2_slam_rise') {
      this.dAiState = 'p2_slam_rise';
      this.dAiTimer = 0.42 / spd;
      this.dSwoopHitDone = false;
      sound.playWingGust();
      sound.playDragonSnarl(true);
    } else if (pick === 'p2_vortex_pull') {
      this.dAiState = 'p2_vortex_pull';
      this.dAiTimer = 0.5 / spd;
      this.dSwoopHitDone = false;
      sound.playWingGust();
      sound.playDragonSnarl(true);
    } else if (pick === 'p2_ember_orbs') {
      this.dAiState = 'p2_ember_orbs';
      this.dAiTimer = 0.42 / spd;
      sound.playWyvernTelegraph('crystal', true);
      for (let i = -1; i <= 1; i++) {
        const ox = Math.max(55, Math.min(WORLD_WIDTH - 55, wCenterX + i * 76));
        const oy = Math.max(125, Math.min(242, this.wY - 14 + Math.abs(i) * 20));
        this.emberOrbs.push({
          x: ox,
          y: oy,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 8,
          fuse: 1.95,
          maxFuse: 1.95,
        });
        this.spawnInfernalBurst(ox, oy, 8);
      }
    } else if (pick === 'p2_spiral_windup') {
      this.dAiState = 'p2_spiral_windup';
      this.dAiTimer = 0.36 / spd;
      this.dSpiralPass = 0;
      this.dSpiralHitDone = false;
      sound.playWyvernTelegraph('swoop', true);
    } else if (pick === 'p2_roar_nova_windup') {
      this.dAiState = 'p2_roar_nova_windup';
      this.dAiTimer = 0.52 / spd;
      this.dDashHitDone = false;
      sound.playDragonSnarl(enraged);
    } else if (pick === 'ld_triple_blink_windup') {
      // 11) Triple Blink-Slash Blitz
      this.dAiState = 'ld_triple_blink_windup';
      this.dComboHitIndex = 0;
      this.dAiTimer = 0.24 / spd;
      this.dBlinkAfterMove = 'ld_triple_blink_slash';
      sound.playWyvernTelegraph('blink', true);
    } else if (pick === 'ld_xbeam_windup') {
      // 12) Intersecting X-Beam Inferno
      this.dAiState = 'ld_xbeam_windup';
      this.dAiTimer = 0.5 / spd;
      this.dBeamHitDone = false;
      this.ldXBeamHitDone = false;
      this.dBeamTickTimer = 0;
      const mouth = this.getDragonMouthOrChestPos();
      const baseAngle = Math.atan2(this.wY + 10 - mouth.y, wCenterX - mouth.x);
      this.dBeamStartAngle = baseAngle - 0.85;
      this.dBeamEndAngle = baseAngle + 0.85;
      this.dBeamCurrentAngle = this.dBeamStartAngle;
      this.ldXBeamStart2 = baseAngle + 0.85;
      this.ldXBeamEnd2 = baseAngle - 0.85;
      this.ldXBeamAngle2 = this.ldXBeamStart2;
      sound.playWyvernTelegraph('crystal', true);
    } else if (pick === 'ld_skyfall_rise') {
      // 13) Sky-Fall Meteor Cataclysm
      this.dAiState = 'ld_skyfall_rise';
      this.dAiTimer = 0.48 / spd;
      this.ldSkyTargetX = Math.max(96, Math.min(WORLD_WIDTH - 96, (wCenterX + 320) * 0.5));
      this.dSwoopHitDone = false;
      sound.playWingGust();
      sound.playDragonScreech(true);
    } else if (pick === 'ld_tailsaw_windup') {
      // 14) 360° Aerial Tail-Flame Saw
      this.dAiState = 'ld_tailsaw_windup';
      this.dAiTimer = 0.34 / spd;
      this.dTailHitDone = false;
      this.ldSawSpinAccum = 0;
      sound.playWyvernTelegraph('tail', true);
    } else if (pick === 'ld_fake_stagger') {
      // 15) Fake-Stagger Bait Counter
      this.dAiState = 'ld_fake_stagger';
      this.dAiTimer = 0.62 / spd;
      this.dDashHitDone = false;
      sound.playDeathFakeoutCollapse();
    } else if (pick === 'ld_wingclap_windup') {
      // 16) Twin Magma Wing-Clap
      this.dAiState = 'ld_wingclap_windup';
      this.dAiTimer = 0.44 / spd;
      sound.playWingGust();
      sound.playDragonSnarl(true);
    } else if (pick === 'ld_triswoop_windup') {
      // 17) Relentless 3-Swoop Dive Chain
      this.dAiState = 'ld_triswoop_windup';
      this.dComboHitIndex = 0;
      this.dAiTimer = 0.28 / spd;
      this.dSwoopHitDone = false;
      sound.playWyvernTelegraph('swoop', true);
    } else if (pick === 'ld_matrix_windup') {
      // 18) Scorching Floor Eruption Matrix
      this.dAiState = 'ld_matrix_windup';
      this.dAiTimer = 0.42 / spd;
      sound.playDragonScreech(true);
      const startEven = Math.random() < 0.5;
      const baseX = startEven ? 88 : 132;
      for (let i = 0; i < 5; i++) {
        const px = Math.max(44, Math.min(WORLD_WIDTH - 44, baseX + i * 108));
        this.flamePillars.push({
          x: px,
          y: getBaseFloorYAt(px),
          warnTimer: 0.72,
          activeTimer: 0.52,
          hitDone: false,
        });
      }
    } else if (pick === 'ld_phoenix_swarm') {
      // 19) Homing Phoenix Ember Swarm
      this.dAiState = 'ld_phoenix_swarm';
      this.dAiTimer = 0.44 / spd;
      sound.playRealisticFireBreath(true);
      const mouth = this.getDragonMouthOrChestPos();
      for (let i = -2; i <= 2; i++) {
        const ang = Math.atan2(this.wY + 10 - mouth.y, wCenterX - mouth.x) + i * 0.28;
        const speed = 195 + Math.abs(i) * 14;
        this.shards.push({
          x: mouth.x,
          y: mouth.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          life: 2.8,
          reflected: false,
          fiery: true,
          homing: true,
        });
      }
    } else if (pick === 'ld_finisher_roar') {
      // 20) Cataclysmic "Last Dance" Finisher Combo
      this.dAiState = 'ld_finisher_roar';
      this.dAiTimer = 0.36 / spd;
      this.ldFinisherStep = 0;
      sound.playDragonFuriousRoar();
      this.triggerDirectionalShake(0, -1, 5.8, 0.3);
    }
  }

  private triggerWingVaultOrDash(forceSideFlip = true): void {
    const core = this.getDragonCoreCenter();
    const wCenterX = this.wX + 16;
    const enraged = this.dPhase2Triggered;
    const spd = this.lastDanceMode ? 1.48 : this.dFurious ? 1.22 : 1.0;

    this.dDwellTimer = 0;
    this.dDwellAnchorX = core.x;
    this.dDwellAnchorY = core.y;
    this.dCornerCrowdTimer = 0;
    if (forceSideFlip) {
      this.dFlankSide = core.x >= wCenterX ? -1 : 1;
    }

    // In Phase 2 / Last Dance, occasionally blink across the arena instead of vaulting
    if (enraged && Math.random() < (this.lastDanceMode ? 0.36 : 0.22)) {
      const targetCenterX = Math.max(
        68,
        Math.min(WORLD_WIDTH - 68, wCenterX + this.dFlankSide * (120 + Math.random() * 55))
      );
      this.dBlinkTargetX = targetCenterX - WYVERN_W / 2;
      this.dBlinkTargetY = 112 + Math.random() * 48;
      this.dAiState = 'blink_fade';
      this.dAiTimer = 0.14 / spd;
      this.dBlinkAfterMove = 'reposition_glide';
      sound.playWyvernTelegraph('blink', true);
      this.spawnInfernalBurst(core.x, core.y, 14);
      return;
    }

    const desiredCenterX = Math.max(
      64,
      Math.min(WORLD_WIDTH - 64, wCenterX + this.dFlankSide * (115 + Math.random() * 55))
    );
    this.dVaultTargetX = desiredCenterX - WYVERN_W / 2;
    this.dAiState = 'wing_vault';
    this.dAiTimer = (this.lastDanceMode ? 0.34 : enraged ? 0.42 : 0.5) / spd;
    this.dVx = (this.dVaultTargetX - this.dX) / Math.max(0.18, this.dAiTimer);
    this.dVy = -265;
    this.dFacing = wCenterX >= core.x ? 1 : -1;
    sound.playWingGust();
    this.spawnDustBurst(core.x, core.y + 18, enraged ? '#F97316' : '#66F2FF');
  }

  private updateWyvern(dt: number): void {
    if (this.dFlashTimer > 0) this.dFlashTimer = Math.max(0, this.dFlashTimer - dt);
    if (this.dHurtTimer > 0) this.dHurtTimer = Math.max(0, this.dHurtTimer - dt);
    if (this.dReboundTimer > 0) this.dReboundTimer = Math.max(0, this.dReboundTimer - dt);
    if (this.dHitDecayTimer > 0) {
      this.dHitDecayTimer -= dt;
      if (this.dHitDecayTimer <= 0) this.dRecentHits = 0;
    }
    if (this.dPlayerRollDecay > 0) {
      this.dPlayerRollDecay -= dt;
      if (this.dPlayerRollDecay <= 0) this.dPlayerRollSpam = 0;
    }

    const core = this.getDragonCoreCenter();
    const wCenterX = this.wX + 16;
    const dx = wCenterX - core.x;
    const absDist = Math.abs(dx);
    const enraged = this.dPhase2Triggered;
    const spd = this.lastDanceMode ? 1.48 : this.dFurious ? 1.22 : 1.0;
    const dmgMult = this.lastDanceMode ? 1.32 : this.dFurious ? 1.18 : 1.0;
    const bossScale = (base: number) => Math.round(base * dmgMult);
    this.dGlideTime += dt * (this.lastDanceMode ? 1.85 : enraged ? 1.42 : 1.0);

    const floorHere = getBaseFloorYAt(core.x);
    const groundTop = floorHere - WYVERN_H + 6;

    if (this.dAiState === 'defeated') {
      if (this.dY < groundTop) {
        this.dVy += 480 * dt;
        this.dY = Math.min(groundTop, this.dY + this.dVy * dt);
      }
      return;
    }

    // Dragon watches Warrior resurrect in stunned awe before the 3-second "THE LAST DANCE" standoff
    if (this.dAiState === 'dragon_react') {
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dAiTimer -= dt;
      const bob = Math.sin(this.elapsed * 5) * 3;
      this.dY += (144 + bob - this.dY) * Math.min(1, 4 * dt);

      if (this.dAiTimer <= 1.25 && !this.dReactRoared) {
        this.dReactRoared = true;
        this.lastEvent = { type: 'dragon_furious' };
        sound.playDragonSnarl(true);
        this.triggerDirectionalShake(0, 1, 5.2, 0.38);
        this.spawnInfernalBurst(core.x, core.y, 24);
        this.emitHud();
      }
      if (this.dAiTimer <= 0 && this.wAwakeningTimer <= 0 && this.lastDanceTimer <= 0) {
        this.beginWyvernMove('p2_roar_nova_windup');
      }
      return;
    }

    // Automatic 3-Second "THE LAST DANCE" Mutual Energy-Gathering Standoff
    if (this.dAiState === 'last_dance_charge') {
      this.dFacing = dx >= 0 ? 1 : -1;
      const desiredX = Math.max(
        48,
        Math.min(WORLD_WIDTH - WYVERN_W - 48, wCenterX + (core.x >= wCenterX ? 142 : -142) - WYVERN_W / 2)
      );
      this.dX += (desiredX - this.dX) * Math.min(1, 4.5 * dt);
      this.dY += (148 + Math.sin(this.elapsed * 9) * 4 - this.dY) * Math.min(1, 5 * dt);
      this.dAiTimer -= dt;

      // Violent volcanic / abyssal firestorm surging around the Dragon with lifting embers
      if (Math.random() < 0.94) {
        const ang = Math.random() * Math.PI * 2;
        const distR = 24 + Math.random() * 34;
        this.pushParticle({
          x: core.x + Math.cos(ang) * distR,
          y: core.y + Math.sin(ang) * (distR * 0.65),
          vx: -Math.cos(ang) * 42,
          vy: -38 - Math.random() * 34,
          life: 0.34,
          maxLife: 0.34,
          color: Math.random() < 0.45 ? '#EF4444' : Math.random() < 0.55 ? '#F97316' : '#FEF08A',
          size: Math.random() < 0.45 ? 2 : 1,
          gravity: -28,
        });
      }
      return;
    }

    // 1) Ground Collapse Fake-Out -> 2) Awakening & Molten Rise -> 3) Massive Explosion -> 4) Full 1500 HP!
    if (this.dAiState === 'death_fakeout') {
      this.dAiTimer -= dt;
      if (!this.dFakeoutLanded) {
        this.dVy += 580 * dt;
        this.dY += this.dVy * dt;
        if (this.dY >= groundTop) {
          this.dY = groundTop;
          this.dVy = 0;
          this.dFakeoutLanded = true;
          sound.playGroundCrash();
          this.triggerDirectionalShake(0, 1, 5.5, 0.36);
          this.spawnDustBurst(core.x, floorHere, '#a8a29e');
          this.shockwaves.push({
            x: core.x,
            y: floorHere,
            radius: 10,
            maxRadius: 68,
            life: 0.34,
            maxLife: 0.34,
            color: '#cbd5e1',
          });
        }
      }

      if (this.dAiTimer <= 0) {
        this.dPhase2Triggered = true;
        this.dMaxHp = BATTLE_CONFIG.dragonPhase2MaxHp;
        this.dHp = 0;
        this.dAiState = 'transforming';
        this.dAiTimer = 1.4;
        this.dVx = 0;
        this.dVy = 0;
        this.dMoveHistory = [];
        this.dQueuedChain = 'p2_beam_windup';

        this.lastEvent = { type: 'dragon_phase2' };
        sound.playPhaseTwoRoar();
        this.triggerDirectionalShake(0, -1, 4.6, 0.85);
        this.spawnInfernalBurst(core.x, core.y, 26);
        this.emitHud();
      }
      return;
    }

    if (this.dAiState === 'transforming') {
      this.dAiTimer -= dt;
      this.dY += (140 - this.dY) * Math.min(1, 3.8 * dt);
      const progress = Math.min(1, Math.max(0, 1 - this.dAiTimer / 1.4));
      this.dHp = Math.round(BATTLE_CONFIG.dragonPhase2MaxHp * progress);

      if (Math.random() < 0.78) {
        this.spawnInfernalBurst(
          core.x + (Math.random() - 0.5) * 34,
          core.y + (Math.random() - 0.5) * 26,
          2
        );
      }

      if (this.dAiTimer <= 0) {
        this.dHp = BATTLE_CONFIG.dragonPhase2MaxHp;
        this.wAirJumpsLeft = 2;

        sound.playInfernalExplosion();
        this.triggerDirectionalShake(0, 1, 9.2, 0.6);
        this.shockwaves.push(
          {
            x: core.x,
            y: core.y,
            radius: 14,
            maxRadius: 165,
            life: 0.54,
            maxLife: 0.54,
            color: '#FDE047',
          },
          {
            x: core.x,
            y: core.y,
            radius: 10,
            maxRadius: 120,
            life: 0.44,
            maxLife: 0.44,
            color: '#DC2626',
          }
        );
        this.spawnInfernalBurst(core.x, core.y, 48);

        for (const offset of [-58, 0, 58]) {
          const fx = Math.max(28, Math.min(WORLD_WIDTH - 48, core.x + offset));
          this.spawnFlamePatch(fx, getBaseFloorYAt(fx), 28);
        }

        const distToBlast = Math.hypot(wCenterX - core.x, this.wY + 12 - core.y);
        if (distToBlast <= 125) {
          this.damageWarrior(32, wCenterX >= core.x ? 1 : -1, false);
        }

        this.dAiState = 'recover';
        this.dAiTimer = 0.25;
        this.dRecoverAnchorX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, this.dX));
        this.emitHud();
      }
      return;
    }

    if (this.dAiState === 'stunned') {
      this.dVx *= Math.pow(0.05, dt);
      this.dX += this.dVx * dt;
      const stunStrafe = Math.sin(this.elapsed * 4.5) * 14;
      const hoverStunY = Math.min(groundTop - 8, 200) + Math.sin(this.elapsed * 5.2) * 3;
      this.dX += stunStrafe * dt;
      this.dY += (hoverStunY - this.dY) * Math.min(1, 5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dDwellTimer = 0;
        this.triggerWingVaultOrDash(true);
      }
      this.dX = Math.max(16, Math.min(WORLD_WIDTH - WYVERN_W - 16, this.dX));
      return;
    }

    // Strict Anti-Stationary / Max Dwell-Time Enforcer (1.0 - 1.35s hard cap)
    const dwellDist = Math.hypot(core.x - this.dDwellAnchorX, core.y - this.dDwellAnchorY);
    if (dwellDist > 42) {
      this.dDwellAnchorX = core.x;
      this.dDwellAnchorY = core.y;
      this.dDwellTimer = 0;
    } else {
      this.dDwellTimer += dt;
    }

    // Anti-Corner & Anti-Crowding Tracker
    const nearArenaEdge = core.x < 92 || core.x > WORLD_WIDTH - 92;
    const playerCrowding = absDist < 68 && Math.abs(this.wY - core.y) < 68;
    if ((nearArenaEdge && absDist < 140) || playerCrowding) {
      this.dCornerCrowdTimer += dt * (nearArenaEdge ? 1.45 : 1.0);
    } else {
      this.dCornerCrowdTimer = Math.max(0, this.dCornerCrowdTimer - dt * 1.1);
    }

    const maxDwell = this.lastDanceMode ? 0.92 : enraged ? 1.12 : 1.32;
    const cornerThreshold = this.lastDanceMode ? 0.34 : enraged ? 0.45 : 0.58;
    const canImmediateBreak =
      this.dAiState === 'hover' ||
      this.dAiState === 'reposition_glide' ||
      (this.dAiState === 'recover' && this.dDwellTimer >= maxDwell);

    if (canImmediateBreak && (this.dDwellTimer >= maxDwell || this.dCornerCrowdTimer >= cornerThreshold)) {
      this.triggerWingVaultOrDash(true);
      return;
    }

    if (absDist < 76 && Math.abs(this.wY + 12 - core.y) < 55) {
      this.dPlayerCampTimer += dt;
    } else {
      this.dPlayerCampTimer = Math.max(0, this.dPlayerCampTimer - dt * 0.8);
    }

    // SOULS-LIKE REACTIVE BOSS AI
    const chooseNextMove = () => {
      const playerHealing = this.wHealAnimTimer > 0.05;
      const playerRollingSpam = this.dPlayerRollSpam >= 2;
      const playerElevated = this.wY < 215;

      if (!enraged) {
        // PHASE 1: 5 Distinct Randomized Attacks with anti-repetition & spacing logic
        const pool: WyvernAiState[] = [
          'p1_swoop_windup',
          'p1_tail_windup',
          'p1_shard_volley',
          'p1_gust_backstep',
          'p1_beam_windup',
        ];
        const fresh = pool.filter((m) => !this.dMoveHistory.slice(-2).includes(m));
        const weighted: WyvernAiState[] = [];
        for (const m of fresh.length > 0 ? fresh : pool) {
          if (m === 'p1_tail_windup' && absDist < 110) weighted.push(m, m);
          if (m === 'p1_gust_backstep' && (this.dRecentHits >= 3 || this.dPlayerCampTimer > 1.1)) {
            weighted.push(m, m, m);
          }
          if (m === 'p1_swoop_windup' && (playerHealing || absDist > 125)) weighted.push(m, m);
          if (m === 'p1_shard_volley' && (playerElevated || absDist > 130)) weighted.push(m, m);
          if (m === 'p1_beam_windup' && absDist >= 75 && absDist <= 230) weighted.push(m, m);
          weighted.push(m);
        }
        if (this.dRecentHits >= 3) {
          this.dRecentHits = 0;
          this.dPlayerCampTimer = 0;
        }
        const pick = weighted[Math.floor(Math.random() * weighted.length)] ?? 'p1_swoop_windup';
        this.beginWyvernMove(pick);
        return;
      }

      // PHASE 2 (10 Moves) -> Expands to 20 Distinct Apex Attacks in "THE LAST DANCE" Overdrive!
      const p2Pool: WyvernAiState[] = [
        'p2_combo_windup',
        'p2_beam_windup',
        'p2_feint_blink',
        'p2_meteor_barrage',
        'p2_tail_windup',
        'p2_slam_rise',
        'p2_vortex_pull',
        'p2_ember_orbs',
        'p2_spiral_windup',
        'p2_roar_nova_windup',
      ];
      if (this.lastDanceMode) {
        p2Pool.push(
          'ld_triple_blink_windup',
          'ld_xbeam_windup',
          'ld_skyfall_rise',
          'ld_tailsaw_windup',
          'ld_fake_stagger',
          'ld_wingclap_windup',
          'ld_triswoop_windup',
          'ld_matrix_windup',
          'ld_phoenix_swarm',
          'ld_finisher_roar'
        );
      }
      const historyWindow = this.lastDanceMode ? 3 : 2;
      const freshP2 = p2Pool.filter((m) => !this.dMoveHistory.slice(-historyWindow).includes(m));
      const candidates = freshP2.length > 0 ? freshP2 : p2Pool.filter((m) => m !== this.dLastAttack);
      const weighted: WyvernAiState[] = [];

      for (const m of candidates) {
        if (
          playerHealing &&
          (m === 'p2_feint_blink' ||
            m === 'p2_spiral_windup' ||
            m === 'ld_triple_blink_windup' ||
            m === 'ld_triswoop_windup')
        ) {
          weighted.push(m, m, m);
        }
        if (
          playerRollingSpam &&
          (m === 'p2_combo_windup' ||
            m === 'p2_slam_rise' ||
            m === 'ld_fake_stagger' ||
            m === 'ld_tailsaw_windup')
        ) {
          weighted.push(m, m, m);
        }
        if (
          (this.dRecentHits >= 3 || this.dPlayerCampTimer >= 1.1) &&
          (m === 'p2_roar_nova_windup' ||
            m === 'ld_fake_stagger' ||
            m === 'ld_skyfall_rise' ||
            m === 'p2_vortex_pull')
        ) {
          weighted.push(m, m, m);
        }
        if (
          absDist < 105 &&
          (m === 'p2_combo_windup' ||
            m === 'p2_tail_windup' ||
            m === 'ld_tailsaw_windup' ||
            m === 'ld_fake_stagger')
        ) {
          weighted.push(m, m);
        }
        if (
          absDist >= 115 &&
          (m === 'p2_beam_windup' ||
            m === 'p2_meteor_barrage' ||
            m === 'ld_xbeam_windup' ||
            m === 'ld_phoenix_swarm' ||
            m === 'ld_wingclap_windup')
        ) {
          weighted.push(m, m);
        }
        if (
          playerElevated &&
          (m === 'ld_skyfall_rise' ||
            m === 'ld_xbeam_windup' ||
            m === 'ld_triswoop_windup' ||
            m === 'ld_phoenix_swarm')
        ) {
          weighted.push(m, m);
        }
        if (this.lastDanceMode && m.startsWith('ld_')) {
          weighted.push(m);
        }
        weighted.push(m);
      }

      this.dRecentHits = 0;
      this.dPlayerCampTimer = 0;
      this.dPlayerRollSpam = 0;

      const pick = weighted[Math.floor(Math.random() * weighted.length)] ?? 'p2_combo_windup';

      // Cunning multi-angle follow-ups (relentless 95% chain rate in Last Dance!)
      if (!this.dQueuedChain && Math.random() < (this.lastDanceMode ? 0.95 : this.dFurious ? 0.92 : 0.78)) {
        const chainMap: Partial<Record<WyvernAiState, WyvernAiState[]>> = {
          p2_ember_orbs: ['p2_vortex_pull', 'ld_triswoop_windup'],
          p2_meteor_barrage: ['p2_feint_blink', 'ld_triple_blink_windup'],
          p2_roar_nova_windup: ['p2_combo_windup', 'ld_tailsaw_windup'],
          p2_vortex_pull: ['p2_slam_rise', 'ld_wingclap_windup'],
          p2_tail_windup: ['p2_beam_windup', 'ld_xbeam_windup'],
          p2_spiral_windup: ['p2_tail_windup', 'ld_phoenix_swarm'],
          p2_slam_rise: ['p2_beam_windup', 'ld_triple_blink_windup'],
          ld_phoenix_swarm: ['ld_triple_blink_windup', 'ld_triswoop_windup'],
          ld_matrix_windup: ['ld_xbeam_windup', 'p2_vortex_pull'],
          ld_wingclap_windup: ['ld_skyfall_rise', 'ld_finisher_roar'],
          ld_fake_stagger: ['p2_combo_windup', 'ld_tailsaw_windup'],
        };
        const options = chainMap[pick];
        if (options && options.length > 0) {
          const valid = options.filter((o) => this.lastDanceMode || !o.startsWith('ld_'));
          if (valid.length > 0) {
            this.dQueuedChain = valid[Math.floor(Math.random() * valid.length)];
          }
        }
      }

      this.beginWyvernMove(pick);
    };

    // --- UPDATE STATES ---
    if (this.dAiState === 'hover' || this.dAiState === 'reposition_glide') {
      this.dFacing = dx >= 0 ? 1 : -1;
      const isReposition = this.dAiState === 'reposition_glide';
      const spacing = this.lastDanceMode ? 124 : enraged ? 132 : 142;
      const baseAnchorX = Math.max(
        34,
        Math.min(WORLD_WIDTH - WYVERN_W - 34, wCenterX + this.dFlankSide * spacing - WYVERN_W / 2)
      );
      // Organic figure-8 / Lissajous aerial glide so the Wyvern never freezes in space
      const figX = Math.sin(this.dGlideTime * 2.15) * (isReposition ? 54 : 42);
      const figY =
        Math.sin(this.dGlideTime * 4.3) * (isReposition ? 18 : 14) +
        Math.cos(this.dGlideTime * 1.6) * 8;
      this.dHoverTargetX = Math.max(22, Math.min(WORLD_WIDTH - WYVERN_W - 22, baseAnchorX + figX));
      this.dHoverTargetY = Math.max(82, Math.min(groundTop - 22, (isReposition ? 132 : 148) + figY));

      const moveRate = enraged
        ? this.lastDanceMode
          ? 9.2
          : this.dFurious
            ? 7.4
            : 6.2
        : isReposition
          ? 5.4
          : 4.4;
      this.dX += (this.dHoverTargetX - this.dX) * Math.min(1, moveRate * dt);
      this.dY += (this.dHoverTargetY - this.dY) * Math.min(1, moveRate * dt);
      if (isReposition && enraged) this.emitTrailGhost(true);

      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        if (this.dQueuedChain) {
          const next = this.dQueuedChain;
          this.dQueuedChain = null;
          this.beginWyvernMove(next);
        } else {
          chooseNextMove();
        }
      }
    } else if (this.dAiState === 'wing_vault') {
      // High parabolic wing-vault cleanly over the Warrior to switch sides & break corner traps
      this.dAiTimer -= dt;
      this.dVy += 740 * dt;
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dFacing = wCenterX >= core.x ? 1 : -1;
      this.emitTrailGhost(enraged);
      if (this.dAiTimer <= 0) {
        this.dVx = 0;
        this.dVy = 0;
        if (this.dQueuedChain) {
          const next = this.dQueuedChain;
          this.dQueuedChain = null;
          this.beginWyvernMove(next);
        } else {
          chooseNextMove();
        }
      }
    } else if (this.dAiState === 'p1_swoop_windup') {
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dY += (96 + Math.sin(this.dGlideTime * 5) * 6 - this.dY) * Math.min(1, 7.5 * dt);
      const leadX = Math.max(20, Math.min(WORLD_WIDTH - WYVERN_W - 20, wCenterX - this.dFacing * 125 - WYVERN_W / 2));
      this.dX += (leadX - this.dX) * Math.min(1, 4.4 * dt);
      this.dAiTimer -= dt;
      if (!this.dFeintDone && this.dAiTimer <= 0.25) {
        this.dFeintDone = true;
        this.dY += 11;
        sound.playWingGust();
      }
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p1_swoop_dive';
        this.dAiTimer = 0.54;
        this.dSwoopHitDone = false;
        const targetX = Math.max(20, Math.min(WORLD_WIDTH - WYVERN_W - 20, wCenterX - WYVERN_W / 2 + this.dFacing * 56));
        this.dVx = Math.max(-330, Math.min(330, (targetX - this.dX) * 2.6));
        this.dVy = Math.max(95, Math.min(280, (Math.min(214, this.wY - 12) - this.dY) * 2.5));
        sound.playDragonSnarl(false);
      }
    } else if (this.dAiState === 'p1_swoop_dive') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(false);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(32, this.dFacing, true);
        }
      }
      const maxHoverY = getBaseFloorYAt(core.x) - WYVERN_H - 4;
      if (this.dY >= maxHoverY) {
        this.dY = maxHoverY;
        this.dVy = -110;
      }
      if (this.dAiTimer <= 0) {
        this.dVx *= 0.45;
        this.dVy = -85;
        this.dFlankSide = core.x >= wCenterX ? 1 : -1;
        // Heavy swoop dive leaves a crisp 0.56s low-altitude punish window
        this.finishOrChainMove(0.56, true);
      }
    } else if (this.dAiState === 'p1_tail_windup') {
      this.dFacing = dx >= 0 ? 1 : -1;
      const whipX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 50 - WYVERN_W / 2));
      this.dX += (whipX + Math.sin(this.dGlideTime * 6) * 8 - this.dX) * Math.min(1, 5.8 * dt);
      this.dY += (Math.min(202, this.wY - 12) + Math.cos(this.dGlideTime * 5) * 4 - this.dY) * Math.min(1, 5.8 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p1_tail_snap';
        this.dAiTimer = 0.22;
        this.dTailHitDone = false;
        this.dVx = this.dFacing * 155;
        this.dVy = -28;
        sound.playDragonSnarl(false);
        this.triggerDirectionalShake(this.dFacing, 0, 2.5, 0.12);
      }
    } else if (this.dAiState === 'p1_tail_snap') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dVx *= Math.pow(0.18, dt);
      this.dAiTimer -= dt;
      if (!this.dTailHitDone && this.dAiTimer <= 0.18) {
        const whipBox: Box = { x: this.dFacing === 1 ? core.x - 4 : core.x - 58, y: core.y - 12, w: 62, h: 34 };
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(whipBox, wBox)) {
          this.dTailHitDone = true;
          this.damageWarrior(28, this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.32, false);
    } else if (this.dAiState === 'p1_shard_volley') {
      this.dFacing = dx >= 0 ? 1 : -1;
      // Drift backward & weave along sine wave while firing shards
      const driftTargetX = Math.max(
        24,
        Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 165 - WYVERN_W / 2)
      );
      this.dX += (driftTargetX + Math.sin(this.dGlideTime * 3.2) * 18 - this.dX) * Math.min(1, 4.2 * dt);
      this.dY += (144 + Math.sin(this.dGlideTime * 4.5) * 14 - this.dY) * Math.min(1, 4.5 * dt);
      if (this.dAiTimer > 0) {
        this.dAiTimer -= dt;
      } else {
        this.dBurstTimer -= dt;
        if (this.dBurstTimer <= 0 && this.dBurstRemaining > 0) {
          this.dBurstRemaining -= 1;
          this.dBurstTimer = 0.16;
          sound.playRealisticFireBreath(false);
          const mouth = this.getDragonMouthOrChestPos();
          const baseAng = Math.atan2(this.wY + 12 - mouth.y, wCenterX - mouth.x);
          const spread = (Math.random() - 0.5) * 0.36;
          const speed = 178 + Math.random() * 32;
          this.shards.push({
            x: mouth.x,
            y: mouth.y,
            vx: Math.cos(baseAng + spread) * speed,
            vy: Math.sin(baseAng + spread) * speed,
            life: 2.8,
            reflected: false,
            fiery: false,
          });
        }
        if (this.dBurstRemaining <= 0) this.finishOrChainMove(0.34, false);
      }
    } else if (this.dAiState === 'p1_gust_backstep') {
      this.dX += this.dVx * dt;
      this.dY += (174 + Math.sin(this.dGlideTime * 5) * 6 - this.dY) * Math.min(1, 5.4 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p1_gust_dash';
        this.dAiTimer = 0.38;
        this.dFacing = dx >= 0 ? 1 : -1;
        this.dVx = this.dFacing * 345;
        this.dVy = (this.wY - 12 - this.dY) * 2.2;
        sound.playWyvernTelegraph('swoop', false);
      }
    } else if (this.dAiState === 'p1_gust_dash') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(false);
      if (!this.dDashHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dDashHitDone = true;
          this.damageWarrior(30, this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        this.dVx *= 0.3;
        this.finishOrChainMove(0.54, true);
      }
    } else if (this.dAiState === 'p1_beam_windup' || this.dAiState === 'p2_beam_windup') {
      const isP2 = this.dAiState === 'p2_beam_windup';
      this.dFacing = dx >= 0 ? 1 : -1;
      const strafeX = Math.max(
        24,
        Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * (isP2 ? 142 : 128) - WYVERN_W / 2)
      );
      this.dX += (strafeX - this.dX) * Math.min(1, 4.4 * dt);
      this.dY += (138 + Math.sin(this.dGlideTime * 4.2) * 10 - this.dY) * Math.min(1, 5.0 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = isP2 ? 'p2_beam_sweep' : 'p1_beam_sweep';
        this.dAiTimer = isP2 ? 0.88 / spd : 0.48;
        this.dBeamHitDone = false;
        this.dBeamTickTimer = 0;
        this.dVx = -this.dFacing * (isP2 ? 84 * spd : 64);
        sound.playRealisticFireBreath(isP2);
        this.triggerDirectionalShake(this.dFacing, 0.2, isP2 ? 4.8 : 2.8, 0.45);
      }
    } else if (this.dAiState === 'p1_beam_sweep' || this.dAiState === 'p2_beam_sweep') {
      const isP2 = this.dAiState === 'p2_beam_sweep';
      this.dAiTimer -= dt;
      if (this.dBeamTickTimer > 0) this.dBeamTickTimer -= dt;
      const totalDur = isP2 ? 0.88 / spd : 0.48;
      const progress = 1 - Math.max(0, this.dAiTimer) / totalDur;
      // Strafe horizontally & weave altitude while sweeping fire breath
      this.dX += (this.dVx + Math.sin(progress * Math.PI * 2) * 35) * dt;
      this.dY += (140 + Math.sin(progress * Math.PI * 2) * 14 - this.dY) * Math.min(1, 4.5 * dt);
      this.dBeamCurrentAngle =
        this.dBeamStartAngle + (this.dBeamEndAngle - this.dBeamStartAngle) * progress;

      const mouth = this.getDragonMouthOrChestPos();
      const beamLen = isP2 ? 415 : 220;
      const beamHitRadius = isP2 ? 27 : 11;
      const endX = mouth.x + Math.cos(this.dBeamCurrentAngle) * beamLen;
      const endY = mouth.y + Math.sin(this.dBeamCurrentAngle) * beamLen;

      if (Math.random() < (isP2 ? 0.88 : 0.6)) {
        const distAlong = 30 + Math.random() * (beamLen - 40);
        const jitter = (Math.random() - 0.5) * (isP2 ? 36 : 10);
        this.pushParticle({
          x: mouth.x + Math.cos(this.dBeamCurrentAngle) * distAlong,
          y: mouth.y + Math.sin(this.dBeamCurrentAngle) * distAlong + jitter,
          vx: Math.cos(this.dBeamCurrentAngle) * 52 + (Math.random() - 0.5) * 26,
          vy: -22 - Math.random() * 24,
          life: 0.2,
          maxLife: 0.2,
          color: isP2
            ? Math.random() < 0.5
              ? '#FEF08A'
              : '#F97316'
            : Math.random() < 0.5
              ? '#66F2FF'
              : '#FFFFFF',
          size: isP2 ? 2 : 1,
          gravity: -16,
        });
      }

      if (isP2) {
        this.dFlameDropAccum += dt;
        if (this.dFlameDropAccum >= 0.13) {
          this.dFlameDropAccum = 0;
          const fx = Math.max(28, Math.min(WORLD_WIDTH - 48, mouth.x + Math.cos(this.dBeamCurrentAngle) * 145));
          this.spawnFlamePatch(fx, getBaseFloorYAt(fx), 26);
        }
      }

      const wCx = this.wX + 16;
      const wCy = this.wY + 13;
      if (this.pointToSegmentDist(wCx, wCy, mouth.x, mouth.y, endX, endY) <= beamHitRadius) {
        if (isP2) {
          if (this.dBeamTickTimer <= 0) {
            this.dBeamTickTimer = 0.23 / spd;
            this.damageWarrior(bossScale(24), this.dFacing, false, 0.22);
          }
        } else if (!this.dBeamHitDone) {
          this.dBeamHitDone = true;
          this.damageWarrior(28, this.dFacing, false);
        }
      }

      if (this.dAiTimer <= 0) {
        this.finishOrChainMove(isP2 ? 0.54 : 0.62, true);
      }

    // --- PHASE 2 UNIQUE MOVES ---
    } else if (this.dAiState === 'p2_combo_windup') {
      // 1) Roll-Catch Claw Combo (Fast -> Fast -> Delayed Heavy Crush)
      this.dFacing = dx >= 0 ? 1 : -1;
      const chaseX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 54 - WYVERN_W / 2));
      this.dX += (chaseX - this.dX) * Math.min(1, 7.5 * dt);
      this.dY += (Math.min(198, this.wY - 10) - this.dY) * Math.min(1, 7.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p2_combo_strike';
        this.dAiTimer = this.dComboHitIndex === 2 ? 0.24 : 0.16;
        this.dComboHitDone = false;
        this.dVx = this.dFacing * (this.dComboHitIndex === 2 ? 260 : 210);
        sound.playDragonSnarl(true);
      }
    } else if (this.dAiState === 'p2_combo_strike') {
      this.dX += this.dVx * dt;
      this.dVx *= Math.pow(0.08, dt);
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dComboHitDone) {
        const hitBox: Box = {
          x: this.dFacing === 1 ? core.x - 4 : core.x - 46,
          y: core.y - 10,
          w: 50,
          h: 38,
        };
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(hitBox, wBox)) {
          this.dComboHitDone = true;
          const base = this.dComboHitIndex === 2 ? 44 : this.dComboHitIndex === 1 ? 30 : 28;
          this.damageWarrior(bossScale(base), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        if (this.dComboHitIndex === 2) {
          this.shockwaves.push({
            x: core.x + this.dFacing * 20,
            y: getBaseFloorYAt(core.x),
            radius: 6,
            maxRadius: 42,
            life: 0.22,
            maxLife: 0.22,
            color: '#F97316',
          });
          this.finishOrChainMove(0.54, true);
        } else {
          this.dComboHitIndex += 1;
          this.dAiState = 'p2_combo_windup';
          // 3rd hit is intentionally delayed (0.56s) to roll-catch panic dodges!
          this.dAiTimer = (this.dComboHitIndex === 2 ? 0.56 : 0.2) / spd;
          sound.playWyvernTelegraph(this.dComboHitIndex === 2 ? 'tail' : 'swoop', true);
        }
      }
    } else if (this.dAiState === 'p2_feint_blink') {
      // 3) Feint Dive -> Blink Ambush (glides back/up while priming blink)
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dX -= this.dFacing * 65 * dt;
      this.dY += (104 + Math.sin(this.dGlideTime * 6) * 8 - this.dY) * Math.min(1, 6.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'blink_fade';
        this.dAiTimer = 0.18 / spd;
        const behindOffset = this.wFacing === 1 ? -76 : 76;
        let bx = wCenterX + behindOffset - WYVERN_W / 2;
        if (bx < 24 || bx > WORLD_WIDTH - WYVERN_W - 24) {
          bx = wCenterX - behindOffset - WYVERN_W / 2;
        }
        this.dBlinkTargetX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, bx));
        this.dBlinkTargetY = Math.min(198, Math.max(105, this.wY - 12));
        sound.playWyvernTelegraph('blink', true);
        this.spawnInfernalBurst(core.x, core.y, 16);
      }
    } else if (this.dAiState === 'blink_fade') {
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dX = this.dBlinkTargetX;
        this.dY = this.dBlinkTargetY;
        const newCore = this.getDragonCoreCenter();
        this.dFacing = wCenterX >= newCore.x ? 1 : -1;
        this.dFlankSide = newCore.x >= wCenterX ? 1 : -1;
        this.spawnInfernalBurst(newCore.x, newCore.y, 18);
        this.shockwaves.push({
          x: newCore.x,
          y: newCore.y,
          radius: 6,
          maxRadius: 38,
          life: 0.2,
          maxLife: 0.2,
          color: '#F97316',
        });
        this.dAiState = this.dBlinkAfterMove;
        if (this.dBlinkAfterMove === 'reposition_glide') {
          this.dAiTimer = (this.lastDanceMode ? 0.22 : 0.3) / spd;
          this.dVx = 0;
        } else {
          this.dAiTimer = 0.24 / spd;
          this.dSwoopHitDone = false;
          this.dVx = this.dFacing * (this.lastDanceMode ? 340 : 270);
          sound.playDragonSnarl(true);
        }
      }
    } else if (this.dAiState === 'p2_blink_ambush') {
      this.dX += this.dVx * dt;
      this.dVx *= Math.pow(0.15, dt);
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(38), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.32, false);
    } else if (this.dAiState === 'p2_meteor_barrage') {
      // 4) Magma Meteor Barrage — strafes swiftly overhead along a figure-8 arc while firing
      this.dFacing = dx >= 0 ? 1 : -1;
      const swayX = Math.sin(this.dGlideTime * 4.4) * 58;
      this.dY += (90 + Math.cos(this.dGlideTime * 5.2) * 14 - this.dY) * Math.min(1, 5.6 * dt);
      const centerLead = Math.max(
        34,
        Math.min(WORLD_WIDTH - WYVERN_W - 34, wCenterX + this.dFlankSide * 118 + swayX - WYVERN_W / 2)
      );
      this.dX += (centerLead - this.dX) * Math.min(1, 4.8 * dt);
      if (this.dAiTimer > 0) {
        this.dAiTimer -= dt;
      } else {
        this.dMeteorTimer -= dt;
        if (this.dMeteorTimer <= 0 && this.dMeteorRemaining > 0) {
          this.dMeteorRemaining -= 1;
          this.dMeteorTimer = 0.13 / spd;
          sound.playRealisticFireBreath(true);
          const mouth = this.getDragonMouthOrChestPos();
          const targetX = wCenterX + (Math.random() - 0.5) * 140;
          const ang = Math.atan2(this.wY + 18 - mouth.y, targetX - mouth.x);
          const speed = (this.lastDanceMode ? 255 : 225) + Math.random() * 55;
          this.shards.push({
            x: mouth.x,
            y: mouth.y,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            life: 2.8,
            reflected: false,
            fiery: true,
          });
        }
        if (this.dMeteorRemaining <= 0) this.finishOrChainMove(0.3, false);
      }
    } else if (this.dAiState === 'p2_tail_windup') {
      // 5) Molten Tail Double-Whip (snap + arcing flame wave)
      this.dFacing = dx >= 0 ? 1 : -1;
      const whipX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 52 - WYVERN_W / 2));
      this.dX += (whipX + Math.sin(this.dGlideTime * 6) * 8 - this.dX) * Math.min(1, 6.4 * dt);
      this.dY += (Math.min(202, this.wY - 12) - this.dY) * Math.min(1, 6.4 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p2_tail_double';
        this.dAiTimer = 0.28;
        this.dTailHitDone = false;
        this.dVx = this.dFacing * 185;
        sound.playDragonSnarl(true);
        this.triggerDirectionalShake(this.dFacing, 0, 3.6, 0.16);
        this.bossWaves.push({
          x: core.x + this.dFacing * 18,
          y: this.wY + 12,
          vx: this.dFacing * 270,
          life: 1.4,
          fiery: true,
        });
      }
    } else if (this.dAiState === 'p2_tail_double') {
      this.dX += this.dVx * dt;
      this.dVx *= Math.pow(0.16, dt);
      this.dAiTimer -= dt;
      if (!this.dTailHitDone && this.dAiTimer <= 0.24) {
        const whipBox: Box = { x: this.dFacing === 1 ? core.x - 4 : core.x - 60, y: core.y - 12, w: 64, h: 36 };
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(whipBox, wBox)) {
          this.dTailHitDone = true;
          this.damageWarrior(bossScale(34), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.28, false);
    } else if (this.dAiState === 'p2_slam_rise') {
      // 6) Infernal Slam & Erupting Flame Pillars
      this.dFacing = dx >= 0 ? 1 : -1;
      const targetHoverX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - WYVERN_W / 2));
      this.dX += (targetHoverX - this.dX) * Math.min(1, 7.2 * dt);
      this.dY += (88 - this.dY) * Math.min(1, 7.2 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p2_slam_drop';
        this.dAiTimer = 0.52;
        this.dVy = 460;
        this.dSwoopHitDone = false;
        sound.playDragonSnarl(true);
      }
    } else if (this.dAiState === 'p2_slam_drop') {
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(38), this.dFacing, true);
        }
      }
      if (this.dY >= groundTop) {
        this.dY = groundTop;
        this.dVy = -155;
        this.dReboundTimer = 0.22;
        sound.playGroundCrash();
        this.triggerDirectionalShake(0, 1, 6.2, 0.32);
        this.shockwaves.push({
          x: core.x,
          y: floorHere,
          radius: 10,
          maxRadius: 88,
          life: 0.3,
          maxLife: 0.3,
          color: '#F97316',
        });
        this.spawnInfernalBurst(core.x, floorHere - 4, 22);
        // Spawn 3 delayed Flame Pillars under player & flanks!
        for (const offset of [-68, 0, 68]) {
          const px = Math.max(36, Math.min(WORLD_WIDTH - 36, wCenterX + offset));
          this.flamePillars.push({
            x: px,
            y: getBaseFloorYAt(px),
            warnTimer: 0.56,
            activeTimer: 0.45,
            hitDone: false,
          });
        }
        // Fair low-altitude rebound punish window (0.56s)
        this.finishOrChainMove(0.56, true);
      } else if (this.dAiTimer <= 0) {
        this.finishOrChainMove(0.5, true);
      }
    } else if (this.dAiState === 'p2_vortex_pull') {
      // 7) Blazing Wing-Vortex & Lunging Bite (orbits gently while pulling inward)
      this.dFacing = dx >= 0 ? 1 : -1;
      const pullDriftX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 115 - WYVERN_W / 2));
      this.dX += (pullDriftX - this.dX) * Math.min(1, 2.2 * dt);
      this.dY += (174 + Math.sin(this.dGlideTime * 6) * 8 - this.dY) * Math.min(1, 5.4 * dt);
      this.dAiTimer -= dt;
      // Pull warrior gently inward with fiery wind
      if (this.wRollTimer <= 0 && absDist > 34 && absDist < 240) {
        this.wVx += (core.x > wCenterX ? 1 : -1) * 320 * dt;
      }
      if (Math.random() < 0.75) {
        const ang = Math.random() * Math.PI * 2;
        const r = 44 + Math.random() * 54;
        this.pushParticle({
          x: core.x + Math.cos(ang) * r,
          y: core.y + Math.sin(ang) * r * 0.5,
          vx: -Math.cos(ang) * 95,
          vy: -Math.sin(ang) * 45,
          life: 0.24,
          maxLife: 0.24,
          color: Math.random() < 0.5 ? '#FDE047' : '#F97316',
          size: 2,
          gravity: 0,
        });
      }
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p2_vortex_bite';
        this.dAiTimer = 0.28 / spd;
        this.dVx = this.dFacing * 330;
        this.dSwoopHitDone = false;
        sound.playDragonSnarl(true);
      }
    } else if (this.dAiState === 'p2_vortex_bite') {
      this.dX += this.dVx * dt;
      this.dVx *= Math.pow(0.12, dt);
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(42), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.52, true);
    } else if (this.dAiState === 'p2_ember_orbs') {
      // 8) Hovering Ember Trap Orbs — actively strafes laterally to flank
      this.dFacing = dx >= 0 ? 1 : -1;
      const flankX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX + this.dFlankSide * 135 - WYVERN_W / 2));
      this.dX += (flankX - this.dX) * Math.min(1, 4.8 * dt);
      this.dY += (134 + Math.sin(this.dGlideTime * 5) * 14 - this.dY) * Math.min(1, 5.2 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.26, false);
    } else if (this.dAiState === 'p2_spiral_windup') {
      // 9) Criss-Cross Spiral Fire Charge (2 diagonal passes)
      this.dFacing = dx >= 0 ? 1 : -1;
      const leadX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 135 - WYVERN_W / 2));
      this.dX += (leadX - this.dX) * Math.min(1, 5.5 * dt);
      this.dY += (104 - this.dY) * Math.min(1, 6.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'p2_spiral_charge';
        this.dAiTimer = 0.34 / spd;
        this.dSpiralHitDone = false;
        this.dVx = this.dFacing * 365;
        this.dVy = this.dSpiralPass === 0 ? 145 : -130;
        sound.playRealisticFireBreath(true);
      }
    } else if (this.dAiState === 'p2_spiral_charge') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (Math.random() < 0.7) {
        this.spawnInfernalBurst(core.x, core.y, 1);
      }
      if (!this.dSpiralHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSpiralHitDone = true;
          this.damageWarrior(bossScale(36), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        if (this.dSpiralPass === 0) {
          this.dSpiralPass = 1;
          this.dSpiralHitDone = false;
          this.dFacing = wCenterX >= core.x ? 1 : -1;
          this.dVx = this.dFacing * 375;
          this.dVy = (this.wY - 12 - this.dY) * 2.5;
          this.dAiTimer = 0.34 / spd;
          sound.playDragonSnarl(true);
        } else {
          this.dVx *= 0.25;
          this.dFlankSide = core.x >= wCenterX ? 1 : -1;
          this.finishOrChainMove(0.3, false);
        }
      }
    } else if (this.dAiState === 'p2_roar_nova_windup') {
      // 10) Abyssal Roar & Expanding Fire Nova + Immediate Dash Follow-up
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dX -= this.dFacing * 42 * dt;
      this.dY += (160 + Math.sin(this.dGlideTime * 7) * 6 - this.dY) * Math.min(1, 5.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        sound.playInfernalExplosion();
        this.triggerDirectionalShake(0, 1, 6.8, 0.35);
        this.shockwaves.push({
          x: core.x,
          y: core.y,
          radius: 10,
          maxRadius: 126,
          life: 0.38,
          maxLife: 0.38,
          color: '#EF4444',
        });
        this.spawnInfernalBurst(core.x, core.y, 28);
        if (Math.hypot(wCenterX - core.x, this.wY + 12 - core.y) <= 108) {
          this.damageWarrior(bossScale(34), wCenterX >= core.x ? 1 : -1, true);
        }
        this.dAiState = 'p2_roar_nova_dash';
        this.dAiTimer = 0.32 / spd;
        this.dDashHitDone = false;
        this.dVx = this.dFacing * 340;
      }
    } else if (this.dAiState === 'p2_roar_nova_dash') {
      this.dX += this.dVx * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dDashHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dDashHitDone = true;
          this.damageWarrior(bossScale(34), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        this.dVx *= 0.25;
        this.finishOrChainMove(0.52, true);
      }

    // --- APEX "THE LAST DANCE" OVERDRIVE MOVES (11–20) ---
    } else if (this.dAiState === 'ld_triple_blink_windup') {
      // 11) Triple Blink-Slash Blitz
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        const side = this.dComboHitIndex % 2 === 0 ? -1 : 1;
        const bx = wCenterX + side * 66 - WYVERN_W / 2;
        this.dBlinkTargetX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, bx));
        this.dBlinkTargetY = Math.min(198, Math.max(106, this.wY - 12));
        this.dAiState = 'blink_fade';
        this.dAiTimer = 0.12 / spd;
        this.dBlinkAfterMove = 'ld_triple_blink_slash';
        sound.playWyvernTelegraph('blink', true);
        this.spawnInfernalBurst(core.x, core.y, 14);
      }
    } else if (this.dAiState === 'ld_triple_blink_slash') {
      this.dX += this.dVx * dt;
      this.dVx *= Math.pow(0.14, dt);
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(30), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        if (this.dComboHitIndex < 2) {
          this.dComboHitIndex += 1;
          this.dAiState = 'ld_triple_blink_windup';
          this.dAiTimer = 0.14 / spd;
        } else {
          this.finishOrChainMove(0.5, true);
        }
      }
    } else if (this.dAiState === 'ld_xbeam_windup') {
      // 12) Intersecting X-Beam Inferno (strafing laterally while charging)
      this.dFacing = dx >= 0 ? 1 : -1;
      const strafeX = Math.max(
        28,
        Math.min(WORLD_WIDTH - WYVERN_W - 28, wCenterX + this.dFlankSide * 138 - WYVERN_W / 2)
      );
      this.dX += (strafeX - this.dX) * Math.min(1, 5.2 * dt);
      this.dY += (120 + Math.sin(this.dGlideTime * 5) * 10 - this.dY) * Math.min(1, 5.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_xbeam_sweep';
        this.dAiTimer = 0.84 / spd;
        this.dBeamTickTimer = 0;
        this.dVx = -this.dFacing * 96 * spd;
        sound.playRealisticFireBreath(true);
        this.triggerDirectionalShake(this.dFacing, 0, 5.5, 0.45);
      }
    } else if (this.dAiState === 'ld_xbeam_sweep') {
      this.dAiTimer -= dt;
      if (this.dBeamTickTimer > 0) this.dBeamTickTimer -= dt;
      const total = 0.84 / spd;
      const p = 1 - Math.max(0, this.dAiTimer) / total;
      this.dX += (this.dVx + Math.sin(p * Math.PI * 2) * 42) * dt;
      this.dY += (122 + Math.sin(p * Math.PI * 2) * 14 - this.dY) * Math.min(1, 5 * dt);
      this.dBeamCurrentAngle = this.dBeamStartAngle + (this.dBeamEndAngle - this.dBeamStartAngle) * p;
      this.ldXBeamAngle2 = this.ldXBeamStart2 + (this.ldXBeamEnd2 - this.ldXBeamStart2) * p;

      const mouth = this.getDragonMouthOrChestPos();
      const len = 420;
      const end1X = mouth.x + Math.cos(this.dBeamCurrentAngle) * len;
      const end1Y = mouth.y + Math.sin(this.dBeamCurrentAngle) * len;
      const end2X = mouth.x + Math.cos(this.ldXBeamAngle2) * len;
      const end2Y = mouth.y + Math.sin(this.ldXBeamAngle2) * len;

      const wCx = this.wX + 16;
      const wCy = this.wY + 13;
      const hit1 = this.pointToSegmentDist(wCx, wCy, mouth.x, mouth.y, end1X, end1Y) <= 18;
      const hit2 = this.pointToSegmentDist(wCx, wCy, mouth.x, mouth.y, end2X, end2Y) <= 18;
      if ((hit1 || hit2) && this.dBeamTickTimer <= 0) {
        this.dBeamTickTimer = 0.24 / spd;
        this.damageWarrior(bossScale(24), this.dFacing, false, 0.22);
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.5, true);
    } else if (this.dAiState === 'ld_skyfall_rise') {
      // 13) Sky-Fall Meteor Cataclysm
      this.dY -= 380 * dt;
      this.dX += (this.ldSkyTargetX - WYVERN_W / 2 - this.dX) * Math.min(1, 6.5 * dt);
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_skyfall_crash';
        this.dAiTimer = 0.72;
        this.dVy = 540;
        this.dSwoopHitDone = false;
        sound.playDragonFuriousRoar();
      }
    } else if (this.dAiState === 'ld_skyfall_crash') {
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(40), wCenterX >= core.x ? 1 : -1, true);
        }
      }
      if (this.dY >= groundTop) {
        this.dY = groundTop;
        this.dVy = -165;
        this.dReboundTimer = 0.22;
        sound.playInfernalExplosion();
        this.triggerDirectionalShake(0, 1, 9.4, 0.45);
        this.shockwaves.push({
          x: core.x,
          y: floorHere,
          radius: 12,
          maxRadius: 155,
          life: 0.42,
          maxLife: 0.42,
          color: '#FACC15',
        });
        this.spawnInfernalBurst(core.x, floorHere - 6, 38);
        // Twin opposing tall magma shockwave walls racing outward across the arena!
        this.bossWaves.push(
          { x: core.x - 18, y: floorHere, vx: -255 * spd, life: 1.8, fiery: true, tall: true },
          { x: core.x + 18, y: floorHere, vx: 255 * spd, life: 1.8, fiery: true, tall: true }
        );
        this.finishOrChainMove(0.54, true);
      } else if (this.dAiTimer <= 0) {
        this.finishOrChainMove(0.5, true);
      }
    } else if (this.dAiState === 'ld_tailsaw_windup') {
      // 14) 360° Aerial Tail-Flame Saw
      this.dFacing = dx >= 0 ? 1 : -1;
      const flankX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX + this.dFlankSide * 86 - WYVERN_W / 2));
      this.dX += (flankX - this.dX) * Math.min(1, 6.2 * dt);
      this.dY += (Math.min(185, this.wY - 12) - this.dY) * Math.min(1, 6.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_tailsaw_spin';
        this.dAiTimer = 0.92 / spd;
        this.ldSawSpinAccum = 0;
        this.dTailHitDone = false;
        sound.playVortexSpin();
      }
    } else if (this.dAiState === 'ld_tailsaw_spin') {
      this.dAiTimer -= dt;
      this.dX += Math.sign(dx || 1) * 145 * spd * dt;
      this.dY += (Math.min(186, this.wY - 10) - this.dY) * Math.min(1, 4.5 * dt);
      this.emitTrailGhost(true);
      this.ldSawSpinAccum += dt;
      if (this.ldSawSpinAccum >= 0.11 / spd) {
        this.ldSawSpinAccum = 0;
        const spinAng = this.elapsed * 16;
        this.shards.push({
          x: core.x,
          y: core.y,
          vx: Math.cos(spinAng) * 215,
          vy: Math.sin(spinAng) * 215,
          life: 2.0,
          reflected: false,
          fiery: true,
        });
      }
      if (!this.dTailHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dTailHitDone = true;
          this.damageWarrior(bossScale(32), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.24, false);
    } else if (this.dAiState === 'ld_fake_stagger') {
      // 15) Fake-Stagger Bait Counter (sways slightly while baiting)
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dX += Math.sin(this.elapsed * 9) * 26 * dt;
      this.dY += (Math.min(groundTop - 8, 202) - this.dY) * Math.min(1, 6.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_bait_uppercut';
        this.dAiTimer = 0.28 / spd;
        this.dDashHitDone = false;
        this.dVx = this.dFacing * 360;
        this.dVy = -195;
        sound.playDragonScreech(true);
        this.spawnInfernalBurst(core.x, core.y, 18);
      }
    } else if (this.dAiState === 'ld_bait_uppercut') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dDashHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dDashHitDone = true;
          this.damageWarrior(bossScale(38), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        this.dVx *= 0.25;
        this.dVy = -45;
        this.finishOrChainMove(0.5, true);
      }
    } else if (this.dAiState === 'ld_wingclap_windup') {
      // 16) Twin Magma Wing-Clap
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dX += (320 - WYVERN_W / 2 - this.dX) * Math.min(1, 5.5 * dt);
      this.dY += (178 - this.dY) * Math.min(1, 5.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_wingclap_slam';
        this.dAiTimer = 0.34 / spd;
        this.dVy = -95;
        sound.playWingClapBoom();
        this.triggerDirectionalShake(0, 1, 7.6, 0.34);
        const fY = getBaseFloorYAt(core.x);
        this.shockwaves.push({
          x: core.x,
          y: core.y,
          radius: 10,
          maxRadius: 112,
          life: 0.34,
          maxLife: 0.34,
          color: '#F97316',
        });
        this.bossWaves.push(
          { x: 42, y: getBaseFloorYAt(42), vx: 235 * spd, life: 1.8, fiery: true, tall: true },
          { x: WORLD_WIDTH - 42, y: getBaseFloorYAt(WORLD_WIDTH - 42), vx: -235 * spd, life: 1.8, fiery: true, tall: true }
        );
        this.spawnInfernalBurst(core.x, fY - 14, 24);
      }
    } else if (this.dAiState === 'ld_wingclap_slam') {
      this.dY += this.dVy * dt;
      this.dVy *= Math.pow(0.15, dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.24, false);
    } else if (this.dAiState === 'ld_triswoop_windup') {
      // 17) Relentless 3-Swoop Dive Chain
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dY += (92 - this.dY) * Math.min(1, 7.2 * dt);
      const leadX = Math.max(20, Math.min(WORLD_WIDTH - WYVERN_W - 20, wCenterX - this.dFacing * 118 - WYVERN_W / 2));
      this.dX += (leadX - this.dX) * Math.min(1, 6.2 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_triswoop_dive';
        this.dAiTimer = 0.36 / spd;
        this.dSwoopHitDone = false;
        const swoopAngle = Math.atan2(this.wY + 8 - core.y, wCenterX - core.x);
        this.dVx = Math.cos(swoopAngle) * 395;
        this.dVy = Math.sin(swoopAngle) * 340;
        sound.playDragonSnarl(true);
      }
    } else if (this.dAiState === 'ld_triswoop_dive') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dSwoopHitDone) {
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(wBox, this.getDragonCoreHurtbox())) {
          this.dSwoopHitDone = true;
          this.damageWarrior(bossScale(30), this.dFacing, true);
        }
      }
      if (this.dAiTimer <= 0) {
        if (this.dComboHitIndex < 2) {
          this.dComboHitIndex += 1;
          this.dAiState = 'ld_triswoop_windup';
          this.dAiTimer = (this.dComboHitIndex === 2 ? 0.36 : 0.2) / spd;
          sound.playWyvernTelegraph('swoop', true);
        } else {
          this.dVx *= 0.25;
          this.dVy = -55;
          this.dFlankSide = core.x >= wCenterX ? 1 : -1;
          this.finishOrChainMove(0.5, true);
        }
      }
    } else if (this.dAiState === 'ld_matrix_windup') {
      // 18) Scorching Floor Eruption Matrix (strafes overhead)
      this.dFacing = dx >= 0 ? 1 : -1;
      const strafeX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX + this.dFlankSide * 130 - WYVERN_W / 2));
      this.dX += (strafeX - this.dX) * Math.min(1, 5.2 * dt);
      this.dY += (104 + Math.sin(this.dGlideTime * 5) * 10 - this.dY) * Math.min(1, 5.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_matrix_hold';
        this.dAiTimer = 0.42 / spd;
      }
    } else if (this.dAiState === 'ld_matrix_hold') {
      this.dFacing = dx >= 0 ? 1 : -1;
      const strafeX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFlankSide * 125 - WYVERN_W / 2));
      this.dX += (strafeX - this.dX) * Math.min(1, 4.2 * dt);
      this.dY += (118 + Math.cos(this.dGlideTime * 6) * 12 - this.dY) * Math.min(1, 5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.22, false);
    } else if (this.dAiState === 'ld_phoenix_swarm') {
      // 19) Homing Phoenix Ember Swarm — agile backward glide & altitude weave
      this.dFacing = dx >= 0 ? 1 : -1;
      const backX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, wCenterX - this.dFacing * 158 - WYVERN_W / 2));
      this.dX += (backX - this.dX) * Math.min(1, 5.2 * dt);
      this.dY += (128 + Math.sin(this.dGlideTime * 6) * 14 - this.dY) * Math.min(1, 5.5 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) this.finishOrChainMove(0.2, false);
    } else if (this.dAiState === 'ld_finisher_roar') {
      // 20) Cataclysmic "Last Dance" Finisher Combo
      this.dFacing = dx >= 0 ? 1 : -1;
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        const behindOffset = this.wFacing === 1 ? -86 : 86;
        let bx = wCenterX + behindOffset - WYVERN_W / 2;
        if (bx < 24 || bx > WORLD_WIDTH - WYVERN_W - 24) bx = wCenterX - behindOffset - WYVERN_W / 2;
        this.dBlinkTargetX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, bx));
        this.dBlinkTargetY = 144;
        this.dAiState = 'blink_fade';
        this.dAiTimer = 0.12 / spd;
        this.dBlinkAfterMove = 'ld_finisher_blink';
        sound.playWyvernTelegraph('blink', true);
      }
    } else if (this.dAiState === 'ld_finisher_blink') {
      // Prep sweeping breath immediately behind warrior
      this.dAiState = 'ld_finisher_breath';
      this.dAiTimer = 0.56 / spd;
      this.dBeamTickTimer = 0;
      const mouth = this.getDragonMouthOrChestPos();
      const baseAngle = Math.atan2(this.wY + 10 - mouth.y, wCenterX - mouth.x);
      this.dBeamStartAngle = baseAngle - 0.65;
      this.dBeamEndAngle = baseAngle + 0.72;
      this.dBeamCurrentAngle = this.dBeamStartAngle;
      sound.playRealisticFireBreath(true);
    } else if (this.dAiState === 'ld_finisher_breath') {
      this.dAiTimer -= dt;
      if (this.dBeamTickTimer > 0) this.dBeamTickTimer -= dt;
      const total = 0.56 / spd;
      const p = 1 - Math.max(0, this.dAiTimer) / total;
      this.dX -= this.dFacing * 48 * dt;
      this.dBeamCurrentAngle = this.dBeamStartAngle + (this.dBeamEndAngle - this.dBeamStartAngle) * p;
      const mouth = this.getDragonMouthOrChestPos();
      const endX = mouth.x + Math.cos(this.dBeamCurrentAngle) * 410;
      const endY = mouth.y + Math.sin(this.dBeamCurrentAngle) * 410;
      if (
        this.pointToSegmentDist(wCenterX, this.wY + 13, mouth.x, mouth.y, endX, endY) <= 22 &&
        this.dBeamTickTimer <= 0
      ) {
        this.dBeamTickTimer = 0.22 / spd;
        this.damageWarrior(bossScale(24), this.dFacing, false, 0.2);
      }
      if (this.dAiTimer <= 0) {
        this.dAiState = 'ld_finisher_tailslam';
        this.dAiTimer = 0.44 / spd;
        this.dTailHitDone = false;
        this.dVx = this.dFacing * 240;
        this.dVy = 320;
        sound.playWyvernTelegraph('tail', true);
      }
    } else if (this.dAiState === 'ld_finisher_tailslam') {
      this.dX += this.dVx * dt;
      this.dY += this.dVy * dt;
      this.dAiTimer -= dt;
      this.emitTrailGhost(true);
      if (!this.dTailHitDone) {
        const slamBox: Box = { x: core.x - 42, y: core.y - 14, w: 84, h: 48 };
        const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
        if (this.boxesOverlap(slamBox, wBox)) {
          this.dTailHitDone = true;
          this.damageWarrior(bossScale(38), this.dFacing, true);
        }
      }
      if (this.dY >= groundTop || this.dAiTimer <= 0) {
        if (this.dY >= groundTop) this.dY = groundTop;
        this.dVx = 0;
        this.dVy = -160;
        this.dReboundTimer = 0.22;
        sound.playInfernalExplosion();
        this.triggerDirectionalShake(0, 1, 7.2, 0.32);
        this.spawnInfernalBurst(core.x, floorHere - 4, 24);
        this.spawnFlamePatch(core.x, floorHere, 36);
        this.finishOrChainMove(0.52, true);
      }
    } else if (this.dAiState === 'recover') {
      // Fair low-altitude punish window with smooth rebound & subtle lateral strafe (never frozen)
      this.dFacing = dx >= 0 ? 1 : -1;
      if (this.dReboundTimer > 0) {
        this.dY += this.dVy * dt;
        this.dVy *= Math.pow(0.08, dt);
      } else {
        const bob = Math.sin(this.dGlideTime * 4.5) * 6;
        const punishY = Math.min(groundTop - 16, 178) + bob;
        this.dY += (punishY - this.dY) * Math.min(1, 5.2 * dt);
      }
      const strafeX = this.dRecoverAnchorX + Math.sin(this.dGlideTime * 3.4) * 24;
      this.dX += (strafeX - this.dX) * Math.min(1, 4.2 * dt);
      this.dAiTimer -= dt;
      if (this.dAiTimer <= 0) {
        if (this.dQueuedChain) {
          const next = this.dQueuedChain;
          this.dQueuedChain = null;
          this.beginWyvernMove(next);
        } else {
          // Immediately lift off & flank to the opposite side instead of parking in idle hover!
          this.dFlankSide = Math.random() < 0.72 ? (core.x >= wCenterX ? -1 : 1) : this.dFlankSide;
          if (Math.random() < (this.lastDanceMode ? 0.55 : enraged ? 0.42 : 0.35)) {
            this.triggerWingVaultOrDash(false);
          } else {
            this.dAiState = 'reposition_glide';
            this.dAiTimer = enraged
              ? (this.lastDanceMode ? 0.16 : this.dFurious ? 0.22 : 0.28)
              : 0.34;
          }
        }
      }
    }

    this.dX = Math.max(16, Math.min(WORLD_WIDTH - WYVERN_W - 16, this.dX));
    if (this.dAiState !== 'ld_skyfall_rise' && this.dAiState !== 'ld_skyfall_crash') {
      this.dY = Math.max(62, Math.min(groundTop, this.dY));
    }
  }

  private emitTrailGhost(infernal: boolean): void {
    if (Math.floor(this.elapsed * 45) % 2 === 0) {
      this.wyvernTrails.push({
        x: this.dX,
        y: this.dY,
        facing: this.dFacing,
        infernal,
        life: 0.16,
        maxLife: 0.16,
      });
    }
  }

  private updateFlamePillars(dt: number): void {
    const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
    const dmgScale = this.lastDanceMode ? 1.32 : this.dFurious ? 1.18 : 1.0;
    for (let i = this.flamePillars.length - 1; i >= 0; i--) {
      const fp = this.flamePillars[i];
      if (fp.warnTimer > 0) {
        fp.warnTimer -= dt;
        if (fp.warnTimer <= 0) {
          sound.playFlamePillarErupt();
          this.triggerDirectionalShake(0, -1, 4.2, 0.2);
          this.spawnInfernalBurst(fp.x, fp.y - 24, 14);
        }
      } else {
        fp.activeTimer -= dt;
        if (!fp.hitDone) {
          const pBox: Box = { x: fp.x - 10, y: fp.y - 96, w: 20, h: 96 };
          if (this.boxesOverlap(pBox, wBox)) {
            fp.hitDone = true;
            this.damageWarrior(Math.round(34 * dmgScale), this.wX + 16 >= fp.x ? 1 : -1, false);
          }
        }
        if (fp.activeTimer <= 0) {
          this.flamePillars.splice(i, 1);
        }
      }
    }
  }

  private updateEmberOrbs(dt: number): void {
    const dmgScale = this.lastDanceMode ? 1.32 : this.dFurious ? 1.18 : 1.0;
    for (let i = this.emberOrbs.length - 1; i >= 0; i--) {
      const orb = this.emberOrbs[i];
      orb.fuse -= dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.fuse <= 0) {
        sound.playOrbDetonate();
        this.shockwaves.push({
          x: orb.x,
          y: orb.y,
          radius: 6,
          maxRadius: 42,
          life: 0.22,
          maxLife: 0.22,
          color: '#F97316',
        });
        this.spawnInfernalBurst(orb.x, orb.y, 16);
        if (Math.hypot(this.wX + 16 - orb.x, this.wY + 13 - orb.y) <= 38) {
          this.damageWarrior(Math.round(30 * dmgScale), this.wX + 16 >= orb.x ? 1 : -1, false);
        }
        this.emberOrbs.splice(i, 1);
      }
    }
  }

  private updateBossWaves(dt: number): void {
    const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
    const dmgScale = this.lastDanceMode ? 1.32 : this.dFurious ? 1.18 : 1.0;
    for (let i = this.bossWaves.length - 1; i >= 0; i--) {
      const bw = this.bossWaves[i];
      bw.life -= dt;
      bw.x += bw.vx * dt;
      if (bw.life <= 0 || bw.x < -16 || bw.x > WORLD_WIDTH + 16) {
        this.bossWaves.splice(i, 1);
        continue;
      }
      if (bw.tall && Math.random() < 0.55) {
        this.pushParticle({
          x: bw.x + (Math.random() - 0.5) * 8,
          y: bw.y - Math.random() * 44,
          vx: -bw.vx * 0.12,
          vy: -20 - Math.random() * 18,
          life: 0.2,
          maxLife: 0.2,
          color: Math.random() < 0.5 ? '#FEF08A' : '#EF4444',
          size: 2,
          gravity: -10,
        });
      }
      const waveBox: Box = bw.tall
        ? { x: bw.x - 8, y: bw.y - 52, w: 16, h: 52 }
        : { x: bw.x - 5, y: bw.y - 11, w: 10, h: 22 };
      if (this.boxesOverlap(waveBox, wBox)) {
        const dir = bw.vx >= 0 ? 1 : -1;
        this.bossWaves.splice(i, 1);
        this.damageWarrior(Math.round((bw.tall ? 34 : 30) * dmgScale), dir, true);
      }
    }
  }

  private spawnFlamePatch(x: number, y: number, w: number): void {
    if (this.flamePatches.length >= 12) this.flamePatches.shift();
    this.flamePatches.push({ x, y, w, life: 3.4, maxLife: 3.4 });
  }

  private updateFlamePatches(dt: number): void {
    const wFeetX = this.wX + 16;
    const wFeetY = this.wY + WARRIOR_FEET_OFFSET;
    for (let i = this.flamePatches.length - 1; i >= 0; i--) {
      const fp = this.flamePatches[i];
      fp.life -= dt;
      if (fp.life <= 0) {
        this.flamePatches.splice(i, 1);
        continue;
      }
      if (Math.random() < 0.28) {
        this.pushParticle({
          x: fp.x + (Math.random() - 0.5) * fp.w,
          y: fp.y - 2,
          vx: (Math.random() - 0.5) * 12,
          vy: -18 - Math.random() * 18,
          life: 0.24,
          maxLife: 0.24,
          color: Math.random() < 0.5 ? '#FEF08A' : '#F97316',
          size: 1,
          gravity: -8,
        });
      }
      if (
        this.flameBurnCooldown <= 0 &&
        this.wGrounded &&
        Math.abs(wFeetY - fp.y) <= 6 &&
        Math.abs(wFeetX - fp.x) <= fp.w / 2 + 4
      ) {
        this.flameBurnCooldown = 0.65;
        this.damageWarrior(14, wFeetX >= fp.x ? 1 : -1, false, 0.35);
      }
    }
  }

  private finishOrChainMove(recoverSec: number, isHeavyPunish = false): void {
    const core = this.getDragonCoreCenter();
    const wCenterX = this.wX + 16;
    const enraged = this.dPhase2Triggered;
    const spd = this.lastDanceMode ? 1.48 : this.dFurious ? 1.22 : 1.0;

    if (this.dQueuedChain && enraged) {
      const next = this.dQueuedChain;
      this.dQueuedChain = null;
      this.dAiState = 'reposition_glide';
      this.dAiTimer = this.lastDanceMode ? 0.14 : 0.18;
      this.dQueuedChain = next;
      return;
    }

    this.dQueuedChain = null;
    if (isHeavyPunish) {
      // Crisp 0.50–0.75s fair low-altitude punish opening after heavy attacks
      this.dAiState = 'recover';
      this.dAiTimer = Math.max(0.5, Math.min(0.76, recoverSec));
      this.dRecoverAnchorX = Math.max(24, Math.min(WORLD_WIDTH - WYVERN_W - 24, this.dX));
      return;
    }

    // Light/ranged moves transition directly into active flanking glide (zero dead idle pauses)
    this.dFlankSide = Math.random() < 0.65 ? (core.x >= wCenterX ? -1 : 1) : this.dFlankSide;
    this.dAiState = 'reposition_glide';
    this.dAiTimer = Math.max(0.16, Math.min(0.42, recoverSec / spd));
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  private updateShards(dt: number): void {
    const wBox: Box = { x: this.wX + 8, y: this.wY + 4, w: 16, h: 20 };
    const coreBox = this.getDragonCoreHurtbox();

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.life -= dt;
      if (sh.homing && !sh.reflected) {
        const tx = this.wX + 16;
        const ty = this.wY + 12;
        const speed = Math.hypot(sh.vx, sh.vy) || 195;
        const curAng = Math.atan2(sh.vy, sh.vx);
        const wantAng = Math.atan2(ty - sh.y, tx - sh.x);
        let diff = wantAng - curAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = 2.6 * dt;
        const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
        sh.vx = Math.cos(nextAng) * speed;
        sh.vy = Math.sin(nextAng) * speed;
      }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;

      if (Math.random() < 0.65) {
        this.particles.push({
          x: sh.x,
          y: sh.y + (Math.random() * 4 - 2),
          vx: -sh.vx * 0.14,
          vy: (Math.random() - 0.5) * 14,
          life: 0.14,
          maxLife: 0.14,
          color: sh.reflected
            ? '#ffd147'
            : sh.fiery
              ? Math.random() < 0.5
                ? '#FDE047'
                : '#F97316'
              : Math.random() < 0.5
                ? '#66F2FF'
                : '#7C3AED',
          size: 1,
          gravity: -10,
        });
      }

      const floorAtSh = getBaseFloorYAt(sh.x);
      if (sh.y >= floorAtSh - 2 && sh.vy > 0) {
        if (sh.fiery) {
          this.spawnInfernalBurst(sh.x, floorAtSh - 3, 6);
          this.spawnFlamePatch(sh.x, floorAtSh, 22);
        } else {
          this.spawnCrystalBurst(sh.x, floorAtSh - 3, 6);
        }
        this.shards.splice(i, 1);
        continue;
      }

      if (sh.life <= 0 || sh.x < -16 || sh.x > WORLD_WIDTH + 16 || sh.y > WORLD_HEIGHT + 10) {
        this.shards.splice(i, 1);
        continue;
      }

      if (sh.reflected) {
        const hitCore =
          sh.x - 4 < coreBox.x + coreBox.w &&
          sh.x + 4 > coreBox.x &&
          sh.y - 4 < coreBox.y + coreBox.h &&
          sh.y + 4 > coreBox.y;
        if (hitCore) {
          this.shards.splice(i, 1);
          this.applyDamageToDragon(26, true, sh.vx >= 0 ? 1 : -1, sh.x, sh.y);
        }
        continue;
      }

      const hitWarrior =
        sh.x - 4 < wBox.x + wBox.w &&
        sh.x + 4 > wBox.x &&
        sh.y - 4 < wBox.y + wBox.h &&
        sh.y + 4 > wBox.y;

      if (hitWarrior) {
        if (this.wParryTimer > 0) {
          sh.reflected = true;
          sh.vx = -sh.vx * 1.45;
          sh.vy = -sh.vy * 0.6;
          sh.life = 2.0;
          this.triggerParrySuccess(false);
        } else if (this.wInvulnTimer <= 0) {
          const dir = sh.vx >= 0 ? 1 : -1;
          this.shards.splice(i, 1);
          const shardScale = sh.fiery ? (this.lastDanceMode ? 1.32 : this.dFurious ? 1.18 : 1.0) : 1.0;
          this.damageWarrior(
            Math.round((sh.fiery ? 32 : 22) * shardScale),
            dir,
            false
          );
        }
      }
    }
  }

  private updateParticlesAndVfx(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;

      if (pt.splats && pt.vy > 0) {
        for (const plat of PLATFORMS) {
          if (pt.x >= plat.x && pt.x <= plat.x + plat.w && pt.y >= plat.y && pt.y <= plat.y + 6) {
            this.splats.push({
              x: Math.round(pt.x),
              y: plat.y,
              w: 2 + Math.floor(Math.random() * 3),
              color: pt.color,
              life: 2.2,
            });
            if (this.splats.length > 56) this.splats.shift();
            this.particles.splice(i, 1);
            break;
          }
        }
      }
    }

    for (let i = this.splats.length - 1; i >= 0; i--) {
      this.splats[i].life -= dt;
      if (this.splats[i].life <= 0) this.splats.splice(i, 1);
    }

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life -= dt;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }

    for (let i = this.wyvernTrails.length - 1; i >= 0; i--) {
      this.wyvernTrails[i].life -= dt;
      if (this.wyvernTrails[i].life <= 0) this.wyvernTrails.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const p = 1 - sw.life / sw.maxLife;
      sw.radius = 6 + (sw.maxRadius - 6) * p;
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= 0.92;
    }
  }

  private spawnWhiteRollPuff(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 3,
        vx: -this.wFacing * (12 + Math.random() * 18),
        vy: -8 - Math.random() * 12,
        life: 0.22 + Math.random() * 0.1,
        maxLife: 0.32,
        color: i === 0 ? '#ffffff' : '#e2e8f0',
        size: i % 2 === 0 ? 2 : 1,
        gravity: 24,
      });
    }
  }

  private spawnSlashParticles(x: number, y: number, isCrit: boolean): void {
    const count = isCrit ? 16 : 10;
    const colors = isCrit
      ? ['#ffd147', '#ffffff', '#66F2FF', '#7C3AED']
      : ['#66F2FF', '#ffffff', '#B39BC8', '#C99A6B'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isCrit ? 48 : 30) + Math.random() * 72;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 22,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.44,
        color: colors[i % colors.length],
        size: isCrit && i % 3 === 0 ? 2 : 1,
        gravity: 210,
        splats: i % 2 === 0,
      });
    }
  }

  private spawnCrystalBurst(x: number, y: number, count: number): void {
    const colors = ['#66F2FF', '#12B5E8', '#7C3AED', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * 76;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0.24 + Math.random() * 0.24,
        maxLife: 0.48,
        color: colors[i % colors.length],
        size: i % 2 === 0 ? 2 : 1,
        gravity: 165,
        splats: i % 3 === 0,
      });
    }
  }

  private spawnInfernalBurst(x: number, y: number, count: number): void {
    const colors = ['#FDE047', '#F97316', '#DC2626', '#FFFBEB'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 32 + Math.random() * 88;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 24,
        life: 0.26 + Math.random() * 0.24,
        maxLife: 0.5,
        color: colors[i % colors.length],
        size: i % 2 === 0 ? 2 : 1,
        gravity: 130,
        splats: i % 3 === 0,
      });
    }
  }

  private spawnHealParticles(x: number, y: number): void {
    const colors = ['#34d399', '#a7f3d0', '#ffffff', '#6ee7b7'];
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: x + (Math.random() * 20 - 10),
        y: y + (Math.random() * 12 - 4),
        vx: (Math.random() - 0.5) * 14,
        vy: -28 - Math.random() * 32,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
        color: colors[i % colors.length],
        size: i % 3 === 0 ? 2 : 1,
        gravity: -12,
      });
    }
  }

  private spawnDustBurst(x: number, y: number, tint: string): void {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x + (Math.random() * 16 - 8),
        y: y - Math.random() * 3,
        vx: (Math.random() - 0.5) * 42,
        vy: -12 - Math.random() * 22,
        life: 0.24 + Math.random() * 0.16,
        maxLife: 0.4,
        color: i % 2 === 0 ? '#cbd5e1' : tint,
        size: 2,
        gravity: 50,
      });
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 2
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: scale > 2 ? -44 : -36,
      text,
      color,
      scale,
      life: 0.85,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      const mag = this.shakeMagnitude * (this.shakeTimer / 0.22);
      const jitter = Math.random() * 2 - 1;
      shakeX = Math.round(jitter * mag + this.shakeDirX * mag * 0.45);
      shakeY = Math.round((Math.random() * 2 - 1) * mag + this.shakeDirY * mag * 0.45);
    }

    const cx = Math.round(this.camX) - shakeX;
    const cy = Math.round(this.camY) - shakeY;

    this.drawMistyForestBackdrop(ctx, cx, cy);

    ctx.save();
    if (this.ldZoom > 1.005) {
      ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
      ctx.scale(this.ldZoom, this.ldZoom);
      ctx.translate(-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2);
    }
    ctx.translate(-cx, -cy);

    this.drawForegroundForestRuins(ctx, cx, cy);
    this.drawWeaponDrop(ctx);
    this.drawSkillDrop(ctx);
    this.drawGhostTrail(ctx);
    this.drawWyvernTrails(ctx);
    this.drawCloak(ctx);
    this.drawCharacters(ctx);
    this.drawVfxAndLighting(ctx);

    ctx.restore();

    if (this.ldLetterbox > 0.01) {
      const barH = Math.round(28 * this.ldLetterbox);
      ctx.fillStyle = '#09070f';
      ctx.fillRect(0, 0, VIEW_WIDTH, barH);
      ctx.fillRect(0, VIEW_HEIGHT - barH, VIEW_WIDTH, barH);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.fillRect(0, barH, VIEW_WIDTH, 1);
      ctx.fillRect(0, VIEW_HEIGHT - barH - 1, VIEW_WIDTH, 1);
    }

    if (!this.titleMode) {
      if (this.activeDrop) {
        this.drawEdgeIndicator(ctx, this.activeDrop.x - cx, this.activeDrop.y - 16 - cy, '#66F2FF');
      }
      if (this.activeSkillDrop) {
        this.drawEdgeIndicator(ctx, this.activeSkillDrop.x - cx, this.activeSkillDrop.y - 18 - cy, '#facc15');
      }
    }
  }

  private drawEdgeIndicator(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    color: string
  ): void {
    if (screenX < 10 || screenX > VIEW_WIDTH - 10) {
      const edgeX = screenX < 10 ? 10 : VIEW_WIDTH - 16;
      const edgeY = Math.max(36, Math.min(VIEW_HEIGHT - 36, Math.round(screenY)));
      const pulse = Math.floor(this.elapsed * 8) % 2 === 0;
      ctx.fillStyle = pulse ? color : '#ffffff';
      ctx.fillRect(edgeX, edgeY, 6, 6);
      ctx.fillStyle = '#0e0b14';
      ctx.fillRect(edgeX + 1, edgeY + 1, 4, 4);
      ctx.fillStyle = color;
      ctx.fillRect(edgeX + 2, edgeY + 2, 2, 2);
    }
  }

  private drawMistyForestBackdrop(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const skyBands = [
      { y: 0, h: 38, c: '#293f47' },
      { y: 38, h: 40, c: '#395760' },
      { y: 78, h: 44, c: '#4d737a' },
      { y: 122, h: 48, c: '#6a979e' },
      { y: 170, h: 50, c: '#8fc0c4' },
      { y: 220, h: 50, c: '#b3e0e1' },
    ];
    for (const b of skyBands) {
      ctx.fillStyle = b.c;
      ctx.fillRect(0, b.y, VIEW_WIDTH, b.h);
    }

    const farX = -Math.round(cx * 0.18);
    const farY = -Math.round(cy * 0.12);
    for (let x = farX % 112; x < VIEW_WIDTH + 112; x += 112) {
      ctx.fillStyle = '#7ba8ae';
      ctx.fillRect(x + 14, 18 + farY, 8, 250);
      ctx.fillRect(x + 76, 12 + farY, 6, 256);
      ctx.fillStyle = '#87b7bc';
      ctx.fillRect(x + 42, 130 + farY, 10, 120);
      ctx.fillRect(x + 56, 146 + farY, 8, 104);
      ctx.fillRect(x + 40, 126 + farY, 26, 6);
    }

    const midX = -Math.round(cx * 0.42);
    const midY = -Math.round(cy * 0.28);
    for (let x = midX % 144; x < VIEW_WIDTH + 144; x += 144) {
      ctx.fillStyle = '#3f5b61';
      ctx.fillRect(x + 12, 0, 16, VIEW_HEIGHT);
      ctx.fillStyle = '#4e6f75';
      ctx.fillRect(x + 14, 0, 4, VIEW_HEIGHT);

      ctx.fillStyle = '#5e534d';
      ctx.fillRect(x + 92, 0, 14, VIEW_HEIGHT);
      ctx.fillStyle = '#73665f';
      ctx.fillRect(x + 94, 0, 4, VIEW_HEIGHT);

      ctx.fillStyle = '#5b8f80';
      ctx.fillRect(x - 6, 18 + midY, 52, 26);
      ctx.fillRect(x + 72, 28 + midY, 56, 24);
      ctx.fillStyle = '#75ab97';
      ctx.fillRect(x + 2, 12 + midY, 36, 18);
      ctx.fillRect(x + 80, 22 + midY, 38, 16);

      ctx.fillStyle = '#4e8071';
      ctx.fillRect(x + 34, 42 + midY, 2, 34);
      ctx.fillRect(x + 36, 56 + midY, 2, 24);
      ctx.fillRect(x + 82, 50 + midY, 2, 38);
      ctx.fillRect(x + 114, 48 + midY, 2, 28);
    }
  }

  private drawForegroundForestRuins(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const accentX = Math.round(456 + cx * 0.22);
    const accentY = Math.round(cy * 0.1);
    ctx.fillStyle = '#a87659';
    ctx.fillRect(accentX, 86 + accentY, 18, 198);
    ctx.fillStyle = '#cc997a';
    ctx.fillRect(accentX + 3, 86 + accentY, 6, 198);
    ctx.fillStyle = '#7d533d';
    ctx.fillRect(accentX + 14, 86 + accentY, 4, 198);
    ctx.fillStyle = '#a87659';
    ctx.fillRect(accentX - 18, 108 + accentY, 20, 6);
    ctx.fillRect(accentX + 16, 102 + accentY, 22, 6);
    ctx.fillStyle = '#1f9157';
    ctx.fillRect(accentX - 36, 54 + accentY, 92, 42);
    ctx.fillStyle = '#33c476';
    ctx.fillRect(accentX - 28, 42 + accentY, 76, 36);
    ctx.fillStyle = '#62e89a';
    ctx.fillRect(accentX - 18, 36 + accentY, 48, 20);
    ctx.fillStyle = '#2aad68';
    ctx.fillRect(accentX - 24, 94 + accentY, 2, 26);
    ctx.fillRect(accentX + 36, 94 + accentY, 2, 32);
    ctx.fillRect(accentX + 46, 86 + accentY, 2, 22);

    const bigTreeX = Math.round(14 + cx * 0.08);
    ctx.fillStyle = '#241a18';
    ctx.fillRect(bigTreeX, 42, 44, 240);
    ctx.fillStyle = '#362724';
    ctx.fillRect(bigTreeX + 6, 42, 14, 240);
    ctx.fillStyle = '#140e0e';
    ctx.fillRect(bigTreeX + 34, 42, 10, 240);
    ctx.fillStyle = '#241a18';
    ctx.fillRect(bigTreeX + 44, 118, 46, 12);
    ctx.fillRect(bigTreeX + 76, 98, 28, 10);
    ctx.fillRect(bigTreeX + 44, 154, 30, 8);
    ctx.fillStyle = '#132e30';
    ctx.fillRect(bigTreeX - 20, 0, 146, 86);
    ctx.fillStyle = '#1c4244';
    ctx.fillRect(bigTreeX - 10, 12, 124, 62);
    ctx.fillStyle = '#27595a';
    ctx.fillRect(bigTreeX + 8, 22, 86, 34);
    ctx.fillStyle = '#3a8758';
    ctx.fillRect(bigTreeX + 54, 86, 3, 30);
    ctx.fillRect(bigTreeX + 68, 86, 2, 44);
    ctx.fillRect(bigTreeX + 94, 86, 3, 28);
    ctx.fillRect(bigTreeX + 112, 74, 2, 36);

    for (const m of this.forestMotes) {
      ctx.fillStyle = m.color;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }

    for (const plat of PLATFORMS) {
      if (!plat.oneWay) {
        this.drawStoneTerrace(ctx, plat.x, plat.y, plat.w);
      } else {
        this.drawElevatedRuinsLedge(ctx, plat.x, plat.y, plat.w);
      }
    }

    ctx.fillStyle = '#383640';
    ctx.fillRect(108, 288, 28, 26);
    ctx.fillStyle = '#17151a';
    ctx.fillRect(111, 291, 22, 20);
    ctx.fillStyle = '#73a895';
    ctx.fillRect(113, 293, 18, 16);
    ctx.fillStyle = '#a6d8db';
    ctx.fillRect(115, 295, 14, 7);
    ctx.fillStyle = '#211F24';
    ctx.fillRect(121, 292, 2, 18);
    ctx.fillRect(112, 300, 20, 2);

    ctx.fillStyle = '#383640';
    ctx.fillRect(580, 282, 48, 58);
    ctx.fillStyle = '#121015';
    ctx.fillRect(586, 288, 36, 52);
    ctx.fillRect(592, 284, 24, 6);
    ctx.fillStyle = '#09080b';
    ctx.fillRect(592, 292, 24, 48);

    this.drawMossyBoulder(ctx, 344, 188);

    this.drawMushroom(ctx, 188, 274);
    this.drawMushroom(ctx, 206, 278);
    this.drawMushroom(ctx, 490, 278);
    this.drawMushroom(ctx, 512, 272);
    this.drawMushroom(ctx, 336, 188);

    for (const s of this.splats) {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, 1);
    }
  }

  private drawStoneTerrace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const h = WORLD_HEIGHT - y;
    ctx.fillStyle = '#211F24';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#28252c';
    for (let bx = x + 12; bx < x + w - 12; bx += 24) {
      ctx.fillRect(bx, y + 14, 14, 6);
      ctx.fillRect(bx - 6, y + 28, 16, 6);
    }

    ctx.fillStyle = '#36343d';
    ctx.fillRect(x, y + 2, w, 7);
    ctx.fillRect(x, y, 6, h);
    ctx.fillRect(x + w - 6, y, 6, h);

    ctx.fillStyle = '#4a4854';
    ctx.fillRect(x, y + 2, w, 2);
    ctx.fillStyle = '#141217';
    for (let bx = x; bx < x + w; bx += 12) {
      ctx.fillRect(bx, y + 2, 1, 7);
    }
    ctx.fillRect(x, y + 9, w, 1);

    ctx.fillStyle = '#2a9c42';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#4fd95b';
    ctx.fillRect(x, y - 1, w, 2);
    ctx.fillStyle = '#8cf274';
    for (let gx = x + 2; gx < x + w - 4; gx += 7) {
      ctx.fillRect(gx, y - 1, 4, 1);
      if ((gx * 3) % 5 === 0) {
        ctx.fillRect(gx + 1, y - 3, 1, 2);
        ctx.fillRect(gx + 3, y - 2, 1, 1);
      }
    }
  }

  private drawElevatedRuinsLedge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.fillStyle = '#211F24';
    ctx.fillRect(x + 2, y + 3, w - 4, 9);

    ctx.fillStyle = '#36343d';
    ctx.fillRect(x, y + 2, w, 10);
    ctx.fillStyle = '#211F24';
    ctx.fillRect(x + 4, y + 5, w - 8, 4);
    ctx.fillStyle = '#4a4854';
    ctx.fillRect(x, y + 2, w, 2);
    ctx.fillStyle = '#141217';
    ctx.fillRect(x, y + 12, w, 2);
    for (let bx = x; bx < x + w; bx += 12) {
      ctx.fillRect(bx, y + 2, 1, 10);
    }

    ctx.fillStyle = '#2a9c42';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#4fd95b';
    ctx.fillRect(x, y - 1, w, 2);
    ctx.fillStyle = '#8cf274';
    for (let gx = x + 3; gx < x + w - 4; gx += 8) {
      ctx.fillRect(gx, y - 1, 4, 1);
      if (gx % 3 === 0) {
        ctx.fillRect(gx + 2, y - 3, 1, 2);
      }
    }
  }

  private drawMossyBoulder(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#141217';
    ctx.fillRect(x + 2, y - 15, 22, 15);
    ctx.fillRect(x, y - 11, 26, 11);
    ctx.fillStyle = '#36343d';
    ctx.fillRect(x + 1, y - 10, 24, 9);
    ctx.fillRect(x + 3, y - 14, 20, 12);
    ctx.fillStyle = '#4c4a56';
    ctx.fillRect(x + 4, y - 13, 14, 5);
    ctx.fillStyle = '#2a9c42';
    ctx.fillRect(x + 3, y - 14, 12, 3);
    ctx.fillRect(x + 16, y - 10, 6, 3);
    ctx.fillStyle = '#4fd95b';
    ctx.fillRect(x + 4, y - 15, 9, 2);
    ctx.fillRect(x + 17, y - 11, 4, 2);
    ctx.fillStyle = '#e03c3c';
    ctx.fillRect(x + 20, y - 13, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 20, y - 13, 1, 1);
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(x + 1, y - 3, 2, 3);
    ctx.fillStyle = '#d93636';
    ctx.fillRect(x, y - 5, 4, 2);
    ctx.fillRect(x + 1, y - 6, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y - 5, 1, 1);
    ctx.fillRect(x + 2, y - 6, 1, 1);
  }

  private drawWeaponDrop(ctx: CanvasRenderingContext2D): void {
    if (!this.activeDrop || this.titleMode) return;
    const drop = this.activeDrop;
    const dx = Math.round(drop.x);
    const dy = Math.round(drop.y);
    const bob = Math.round(Math.sin(this.elapsed * 5) * 2);
    const specColor = WEAPON_SPECS[drop.weapon].smearColor;

    ctx.fillStyle = 'rgba(102, 242, 255, 0.16)';
    ctx.fillRect(dx - 6, dy - 64, 12, 64);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(dx - 2, dy - 56, 4, 56);

    ctx.fillStyle = specColor;
    ctx.fillRect(dx - 8, dy - 2, 16, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx - 4, dy - 2, 8, 1);

    const wSheet = this.getWeaponSprite(drop.weapon);
    ctx.drawImage(wSheet.canvas, dx - Math.floor(wSheet.width / 2), dy - 21 + bob);
  }

  private drawSkillDrop(ctx: CanvasRenderingContext2D): void {
    if (!this.activeSkillDrop || this.titleMode) return;
    const drop = this.activeSkillDrop;
    const dx = Math.round(drop.x);
    const dy = Math.round(drop.y);
    const bob = Math.round(Math.cos(this.elapsed * 6) * 2);

    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.fillRect(dx - 7, dy - 72, 14, 72);
    ctx.fillStyle = 'rgba(192, 132, 252, 0.28)';
    ctx.fillRect(dx - 2, dy - 64, 4, 64);

    // Radiant 1px-outlined Super Skill Orb
    const oy = dy - 16 + bob;
    ctx.fillStyle = '#24112B';
    ctx.fillRect(dx - 6, oy - 6, 12, 12);
    ctx.fillStyle = '#9333ea';
    ctx.fillRect(dx - 5, oy - 5, 10, 10);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(dx - 4, oy - 4, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx - 2, oy - 2, 4, 4);
  }

  private getWeaponSprite(weapon: WeaponType): SpriteSheet {
    return this.sprites.weapons[weapon];
  }

  private drawGhostTrail(ctx: CanvasRenderingContext2D): void {
    for (const g of this.ghosts) {
      const sheet = g.frame === 0 ? this.sprites.warrior.roll0 : this.sprites.warrior.roll1;
      const alpha = (g.life / g.maxLife) * 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (g.facing === -1) {
        ctx.translate(Math.round(g.x) + 32, Math.round(g.y));
        ctx.scale(-1, 1);
        ctx.drawImage(sheet.flashCanvas, 0, 0);
      } else {
        ctx.drawImage(sheet.flashCanvas, Math.round(g.x), Math.round(g.y));
      }
      ctx.restore();
    }
  }

  private drawWyvernTrails(ctx: CanvasRenderingContext2D): void {
    for (const wt of this.wyvernTrails) {
      const alpha = (wt.life / wt.maxLife) * 0.36;
      ctx.save();
      ctx.globalAlpha = alpha;
      const sheet = wt.infernal ? this.sprites.infernalDragon.attack : this.sprites.dragon.attack;
      if (wt.facing === 1) {
        ctx.translate(Math.round(wt.x) + WYVERN_W, Math.round(wt.y));
        ctx.scale(-1, 1);
        ctx.drawImage(sheet.flashCanvas, 0, 0);
      } else {
        ctx.drawImage(sheet.flashCanvas, Math.round(wt.x), Math.round(wt.y));
      }
      ctx.restore();
    }
  }

  private drawCloak(ctx: CanvasRenderingContext2D): void {
    if (this.wHp <= 0 || this.wRollTimer > 0 || this.cloakNodes.length < 2) return;
    for (let i = 0; i < this.cloakNodes.length - 1; i++) {
      const n = this.cloakNodes[i];
      ctx.fillStyle = i < 3 ? '#4a8b8c' : '#2f6266';
      const w = i < 2 ? 3 : 2;
      ctx.fillRect(Math.round(n.x), Math.round(n.y), w, w);
    }
  }

  private findSurfaceBelowWarrior(): number {
    const feetX = this.wX + 16;
    const feetY = this.wY + WARRIOR_FEET_OFFSET;
    let bestY = getBaseFloorYAt(feetX);
    for (const plat of PLATFORMS) {
      if (feetX >= plat.x && feetX <= plat.x + plat.w && plat.y >= feetY - 2) {
        if (plat.y < bestY) bestY = plat.y;
      }
    }
    return bestY;
  }

  private drawCharacters(ctx: CanvasRenderingContext2D): void {
    const idleFrame = Math.floor(this.elapsed * 3) % 2;

    const shadowSurfaceY = this.findSurfaceBelowWarrior();
    const hDist = Math.max(0, shadowSurfaceY - (this.wY + WARRIOR_FEET_OFFSET));
    const shadowScale = Math.max(0.45, 1 - hDist / 110);
    const ovalW = Math.round(14 * shadowScale);
    ctx.fillStyle = 'rgba(14, 11, 20, 0.58)';
    ctx.fillRect(Math.round(this.wX + 16 - ovalW / 2), shadowSurfaceY - 1, ovalW, 2);
    ctx.fillRect(
      Math.round(this.wX + 16 - (ovalW - 4) / 2),
      shadowSurfaceY - 2,
      Math.max(4, ovalW - 4),
      1
    );

    if (this.dAiState !== 'blink_fade') {
      const coreCenter = this.getDragonCoreCenter();
      const dFloor = getBaseFloorYAt(coreCenter.x);
      const dShadowW = Math.round(46 * Math.max(0.35, 1 - (dFloor - (coreCenter.y + 18)) / 140));
      ctx.fillStyle = 'rgba(20, 11, 30, 0.44)';
      ctx.fillRect(Math.round(coreCenter.x - dShadowW / 2), dFloor - 2, dShadowW, 3);
    }

    if (this.wHealAnimTimer > 0) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
      ctx.fillRect(Math.round(this.wX + 6), Math.round(this.wY - 6), 20, 32);
    }

    // Active Aegis Shield glow ring around warrior
    if (this.wShield > 0) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
      ctx.fillRect(Math.round(this.wX + 3), Math.round(this.wY), 26, 26);
    }

    // Clear Dead Cells-style Telegraphs
    const isWindingUp =
      this.dAiState === 'p1_swoop_windup' ||
      this.dAiState === 'p1_tail_windup' ||
      this.dAiState === 'p1_shard_volley' ||
      this.dAiState === 'p1_beam_windup' ||
      this.dAiState === 'p1_gust_backstep' ||
      this.dAiState === 'p2_combo_windup' ||
      this.dAiState === 'p2_beam_windup' ||
      this.dAiState === 'p2_feint_blink' ||
      this.dAiState === 'p2_tail_windup' ||
      this.dAiState === 'p2_slam_rise' ||
      this.dAiState === 'p2_vortex_pull' ||
      this.dAiState === 'p2_spiral_windup' ||
      this.dAiState === 'p2_roar_nova_windup' ||
      this.dAiState === 'ld_triple_blink_windup' ||
      this.dAiState === 'ld_xbeam_windup' ||
      this.dAiState === 'ld_tailsaw_windup' ||
      this.dAiState === 'ld_wingclap_windup' ||
      this.dAiState === 'ld_triswoop_windup' ||
      this.dAiState === 'ld_finisher_roar';

    if (isWindingUp) {
      const pulse = Math.floor(this.elapsed * 22) % 2 === 0;
      const anchor =
        this.dAiState === 'p1_tail_windup' ||
        this.dAiState === 'p2_tail_windup' ||
        this.dAiState === 'ld_tailsaw_windup'
          ? this.getDragonTailTipPos()
          : this.getDragonMouthOrChestPos();
      const gx = Math.round(anchor.x);
      const gy = Math.round(anchor.y);

      ctx.fillStyle = pulse ? '#ffd147' : this.dPhase2Triggered ? '#F97316' : '#66F2FF';
      ctx.fillRect(gx - 8, gy - 1, 16, 2);
      ctx.fillRect(gx - 1, gy - 8, 2, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx - 3, gy - 1, 6, 2);
      ctx.fillRect(gx - 1, gy - 3, 2, 6);

      const core = this.getDragonCoreCenter();
      ctx.fillStyle = '#24112B';
      ctx.fillRect(Math.round(core.x - 3), Math.round(this.dY - 12), 6, 12);
      ctx.fillStyle = pulse ? '#ffd147' : this.dPhase2Triggered ? '#F97316' : '#66F2FF';
      ctx.fillRect(Math.round(core.x - 2), Math.round(this.dY - 11), 4, 7);
      ctx.fillRect(Math.round(core.x - 2), Math.round(this.dY - 3), 4, 2);

      if (this.dAiState === 'p2_roar_nova_windup') {
        ctx.strokeStyle = pulse ? '#EF4444' : '#FDE047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.round(core.x), Math.round(core.y), 46 + (pulse ? 8 : 0), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (this.dAiState === 'stunned' || this.dAiState === 'ld_fake_stagger') {
      const core = this.getDragonCoreCenter();
      const isBait = this.dAiState === 'ld_fake_stagger';
      const urgentBait = isBait && this.dAiTimer < 0.24 && Math.floor(this.elapsed * 26) % 2 === 0;
      for (let s = 0; s < 3; s++) {
        const ang = this.elapsed * 8 + s * ((Math.PI * 2) / 3);
        const sx = Math.round(core.x + Math.cos(ang) * 16);
        const sy = Math.round(this.dY + 4 + Math.sin(ang) * 4);
        ctx.fillStyle = urgentBait ? '#EF4444' : '#ffd147';
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    // Draw 32x32 Bearded Warrior (or Awakened Blazing Aura)
    if (this.wHp <= 0 && !this.wAwakeningTimer) {
      if (this.wDeathTimer < 0.2) {
        ctx.drawImage(this.sprites.warrior.hurt.flashCanvas, Math.round(this.wX), Math.round(this.wY));
      } else if (this.wDeathTimer < 1.05) {
        const pulse = Math.floor(this.elapsed * 14) % 2 === 0;
        const crystal = pulse ? this.sprites.warrior.crystal0 : this.sprites.warrior.crystal1;
        const fadeAlpha = Math.max(0, 1 - Math.max(0, this.wDeathTimer - 0.72) / 0.33);
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.drawImage(crystal.canvas, Math.round(this.wX), Math.round(this.wY - 2));
        ctx.restore();
      }
    } else {
      if (this.wAwakened && this.wAwakeningTimer <= 0) {
        const auraPulse = Math.floor(this.elapsed * 18) % 2 === 0;
        ctx.fillStyle = auraPulse ? 'rgba(250, 204, 21, 0.22)' : 'rgba(239, 68, 68, 0.24)';
        ctx.fillRect(Math.round(this.wX + 4), Math.round(this.wY - 2), 24, 28);
      }

      const hideBlink =
        this.wInvulnTimer > 0 &&
        this.wRollTimer <= 0 &&
        this.wAwakeningTimer <= 0 &&
        Math.floor(this.elapsed * 20) % 2 === 0 &&
        this.wFlashTimer <= 0;

      if (!hideBlink) {
        let wSheet = idleFrame === 0 ? this.sprites.warrior.idle0 : this.sprites.warrior.idle1;
        let rollFlipY = false;

        if (this.wAwakeningTimer > 1.15) {
          wSheet = this.sprites.warrior.hurt;
        } else if (this.wRollTimer > 0) {
          const spinIdx = Math.floor(this.elapsed * 24) % 4;
          wSheet = spinIdx % 2 === 0 ? this.sprites.warrior.roll0 : this.sprites.warrior.roll1;
          rollFlipY = spinIdx >= 2;
        } else if (this.wHurtTimer > 0) {
          wSheet = this.sprites.warrior.hurt;
        } else if (this.wAttackTimer > 0 || this.wDiveSlamming) {
          wSheet = this.sprites.warrior.attack;
        } else if (!this.wGrounded) {
          wSheet = this.sprites.warrior.jump;
        } else if (Math.abs(this.wVx) > 12) {
          const runStep = Math.floor(this.wWalkClock) % 4;
          wSheet =
            runStep === 0
              ? this.sprites.warrior.run0
              : runStep === 2
                ? this.sprites.warrior.run2
                : this.sprites.warrior.run1;
        }

        const wSource = this.wFlashTimer > 0 ? wSheet.flashCanvas : wSheet.canvas;
        const drawX = Math.round(this.wX);
        const drawY = Math.round(this.wY);

        ctx.save();
        ctx.translate(drawX + (this.wFacing === -1 ? 32 : 0), drawY + (rollFlipY ? 32 : 0));
        ctx.scale(this.wFacing === -1 ? -1 : 1, rollFlipY ? -1 : 1);
        ctx.drawImage(wSource, 0, 0);

        if (this.wRollTimer <= 0 && this.wAwakeningTimer <= 1.15) {
          const weaponSheet = this.getWeaponSprite(this.wWeapon);
          if (this.wParryTimer > 0) {
            ctx.drawImage(this.sprites.weapons.shield.canvas, 20, 10);
          } else if (this.wAttackTimer > 0) {
            ctx.save();
            ctx.translate(22, 16);
            if (WEAPON_SPECS[this.wWeapon].isThrust) {
              ctx.rotate(1.57);
              ctx.drawImage(weaponSheet.canvas, -6, -16);
            } else {
              ctx.rotate(this.wComboStep === 2 ? -0.45 : 0.78);
              ctx.drawImage(weaponSheet.canvas, -2, -14);
            }
            ctx.restore();
          } else {
            ctx.drawImage(weaponSheet.canvas, 14, 4);
            ctx.drawImage(this.sprites.weapons.shield.canvas, 17, 13);
          }
        }
        ctx.restore();

        if (this.wParryTimer > 0) {
          const px = drawX + (this.wFacing === 1 ? 29 : 1);
          ctx.fillStyle = '#ffd147';
          ctx.fillRect(px, drawY + 8, 2, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + (this.wFacing === 1 ? 1 : 0), drawY + 10, 1, 12);
        }

        if (this.wDiveSlamming) {
          ctx.fillStyle = '#ffd147';
          ctx.fillRect(drawX + 10, drawY + 21, 12, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(drawX + 13, drawY + 24, 6, 4);
        }
      }
    }

    // Draw Heavy Armored Dragon (Phase 1 Crystal / Phase 2 Fiery Infernal / Furious Power-Up)
    if (this.dAiState !== 'blink_fade') {
      const spriteSet = this.dPhase2Triggered ? this.sprites.infernalDragon : this.sprites.dragon;
      const beatSpeed = this.lastDanceMode ? 17 : this.dFurious ? 14.5 : this.dPhase2Triggered ? 11.5 : 7.5;
      const wingCycle = Math.floor(this.elapsed * beatSpeed) % 4;
      let dSheet: SpriteSheet =
        wingCycle === 0
          ? spriteSet.wingUp
          : wingCycle === 2
            ? spriteSet.wingDown
            : spriteSet.wingMid;

      if (this.dAiState === 'defeated' || this.dAiState === 'death_fakeout') {
        dSheet = spriteSet.defeated;
      } else if (
        this.dAiState === 'p1_swoop_dive' ||
        this.dAiState === 'p1_beam_sweep' ||
        this.dAiState === 'p1_shard_volley' ||
        this.dAiState === 'p1_gust_dash' ||
        this.dAiState === 'p2_combo_strike' ||
        this.dAiState === 'p2_beam_sweep' ||
        this.dAiState === 'p2_blink_ambush' ||
        this.dAiState === 'p2_meteor_barrage' ||
        this.dAiState === 'p2_slam_drop' ||
        this.dAiState === 'p2_vortex_bite' ||
        this.dAiState === 'p2_spiral_charge' ||
        this.dAiState === 'p2_roar_nova_dash' ||
        this.dAiState === 'ld_triple_blink_slash' ||
        this.dAiState === 'ld_xbeam_sweep' ||
        this.dAiState === 'ld_skyfall_crash' ||
        this.dAiState === 'ld_tailsaw_spin' ||
        this.dAiState === 'ld_bait_uppercut' ||
        this.dAiState === 'ld_wingclap_slam' ||
        this.dAiState === 'ld_triswoop_dive' ||
        this.dAiState === 'ld_phoenix_swarm' ||
        this.dAiState === 'ld_finisher_roar' ||
        this.dAiState === 'ld_finisher_breath' ||
        this.dAiState === 'ld_finisher_tailslam' ||
        this.dAiState === 'last_dance_charge' ||
        this.dAiState === 'transforming' ||
        (this.dAiState === 'dragon_react' && this.dReactRoared)
      ) {
        dSheet = spriteSet.attack;
      } else if (
        this.dAiState === 'p1_tail_windup' ||
        this.dAiState === 'p2_tail_windup' ||
        this.dAiState === 'ld_tailsaw_windup' ||
        this.dAiState === 'ld_fake_stagger' ||
        this.dHurtTimer > 0 ||
        this.dAiState === 'stunned'
      ) {
        dSheet = spriteSet.coil;
      }

      const dSource = this.dFlashTimer > 0 ? dSheet.flashCanvas : dSheet.canvas;
      const dDrawX = Math.round(this.dX);
      const dDrawY = Math.round(this.dY);

      ctx.save();
      if (this.dFacing === 1) {
        ctx.translate(dDrawX + WYVERN_W, dDrawY);
        ctx.scale(-1, 1);
        ctx.drawImage(dSource, 0, 0);
      } else {
        ctx.drawImage(dSource, dDrawX, dDrawY);
      }
      ctx.restore();

      if (this.dAiState === 'transforming') {
        const core = this.getDragonCoreCenter();
        const progress = Math.min(1, Math.max(0, 1 - this.dAiTimer / 1.4));
        const flashOn = Math.floor(this.elapsed * 26) % 2 === 0;
        ctx.fillStyle = flashOn ? '#FEF08A' : '#F97316';
        for (let k = 0; k < 5; k++) {
          const cx = Math.round(core.x - 14 + k * 7);
          const cy = Math.round(core.y - 10 + ((k * 7) % 16));
          ctx.fillRect(cx, cy, 4, 2);
          ctx.fillRect(cx + 2, cy + 2, 2, 4);
        }
        if (this.dAiTimer <= 0.45) {
          const warnR = Math.round(24 + (1 - this.dAiTimer / 0.45) * 98);
          ctx.strokeStyle = flashOn ? '#FEF08A' : '#F97316';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(Math.round(core.x), Math.round(core.y), warnR, 0, Math.PI * 2);
          ctx.stroke();
        } else if (progress > 0.2) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.24)';
          ctx.fillRect(Math.round(core.x - 18), Math.round(core.y - 18), 36, 36);
        }
      }

      if (this.dAiState === 'p1_tail_snap' || this.dAiState === 'p2_tail_double') {
        const core = this.getDragonCoreCenter();
        const whipDir = this.dFacing;
        const arcX = Math.round(core.x + whipDir * 24);
        const arcY = Math.round(core.y + 2);
        ctx.fillStyle = this.dPhase2Triggered ? '#1A070B' : '#24112B';
        ctx.fillRect(arcX - 24, arcY - 6, 48, 8);
        ctx.fillStyle = this.dPhase2Triggered ? '#EA580C' : '#FAF2E4';
        ctx.fillRect(arcX - 22, arcY - 4, 44, 4);
        ctx.fillStyle = this.dPhase2Triggered ? '#FDE047' : '#66F2FF';
        ctx.fillRect(arcX + whipDir * 16 - 4, arcY - 5, 8, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(arcX + whipDir * 16 - 2, arcY - 3, 4, 2);
      }
    }
  }

  private drawVfxAndLighting(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(205, 242, 242, 0.08)';
    for (const bx of [170, 320, 490]) {
      for (let step = 0; step < 18; step++) {
        ctx.fillRect(bx - step * 3, 50 + step * 11, 22, 11);
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (this.wAwakened && this.wAwakeningTimer <= 0) {
      const wx = this.wX + 16;
      const wy = this.wY + 13;
      const wGrad = ctx.createRadialGradient(wx, wy, 2, wx, wy, 26);
      wGrad.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
      wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = wGrad;
      ctx.fillRect(wx - 26, wy - 26, 52, 52);
    }

    if (this.dAiState !== 'defeated' && this.dAiState !== 'blink_fade') {
      const chest = this.getDragonMouthOrChestPos();
      const tail = this.getDragonTailTipPos();
      const pulseR = this.dFurious ? 38 + Math.sin(this.elapsed * 18) * 5 : this.dPhase2Triggered ? 28 + Math.sin(this.elapsed * 14) * 4 : 16;

      const cGrad = ctx.createRadialGradient(chest.x, chest.y, 1, chest.x, chest.y, pulseR);
      cGrad.addColorStop(
        0,
        this.dFurious
          ? 'rgba(239, 68, 68, 0.72)'
          : this.dPhase2Triggered
            ? 'rgba(249, 115, 22, 0.6)'
            : 'rgba(102, 242, 255, 0.35)'
      );
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cGrad;
      ctx.fillRect(chest.x - pulseR, chest.y - pulseR, pulseR * 2, pulseR * 2);

      const tGrad = ctx.createRadialGradient(tail.x, tail.y, 1, tail.x, tail.y, 13);
      tGrad.addColorStop(
        0,
        this.dPhase2Triggered ? 'rgba(253, 224, 71, 0.5)' : 'rgba(102, 242, 255, 0.42)'
      );
      tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = tGrad;
      ctx.fillRect(tail.x - 13, tail.y - 13, 26, 26);
    }

    if (this.wHp <= 0 && !this.wAwakeningTimer && this.wDeathTimer >= 0.2 && this.wDeathTimer < 1.05) {
      const cx = this.wX + 16;
      const cy = this.wY + 12;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
      grad.addColorStop(0, 'rgba(104, 227, 255, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 24, cy - 24, 48, 48);
    }

    for (const sh of this.shards) {
      const grad = ctx.createRadialGradient(sh.x, sh.y, 1, sh.x, sh.y, 14);
      grad.addColorStop(
        0,
        sh.reflected
          ? 'rgba(255, 209, 71, 0.45)'
          : sh.fiery
            ? 'rgba(249, 115, 22, 0.5)'
            : 'rgba(102, 242, 255, 0.45)'
      );
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sh.x - 14, sh.y - 14, 28, 28);
    }

    if (this.slashSmear.active) {
      const grad = ctx.createRadialGradient(
        this.slashSmear.x,
        this.slashSmear.y,
        2,
        this.slashSmear.x,
        this.slashSmear.y,
        18
      );
      grad.addColorStop(
        0,
        this.wAwakened
          ? 'rgba(249, 115, 22, 0.5)'
          : this.slashSmear.isCrit
            ? 'rgba(255, 215, 80, 0.42)'
            : 'rgba(102, 242, 255, 0.35)'
      );
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(this.slashSmear.x - 18, this.slashSmear.y - 18, 36, 36);
    }
    ctx.restore();

    // Sweeping Fire Breath / Crystal Laser / Intersecting X-Beams
    if (
      this.dAiState === 'p1_beam_windup' ||
      this.dAiState === 'p2_beam_windup' ||
      this.dAiState === 'ld_xbeam_windup'
    ) {
      const isP2 = this.dAiState !== 'p1_beam_windup';
      const mouth = this.getDragonMouthOrChestPos();
      const len = isP2 ? 400 : 215;
      ctx.strokeStyle = isP2 ? 'rgba(249, 115, 22, 0.58)' : 'rgba(102, 242, 255, 0.45)';
      ctx.lineWidth = isP2 ? 3 : 1;
      const angles =
        this.dAiState === 'ld_xbeam_windup'
          ? [this.dBeamStartAngle, this.ldXBeamStart2]
          : [this.dBeamStartAngle];
      for (const ang of angles) {
        ctx.beginPath();
        ctx.moveTo(Math.round(mouth.x), Math.round(mouth.y));
        ctx.lineTo(Math.round(mouth.x + Math.cos(ang) * len), Math.round(mouth.y + Math.sin(ang) * len));
        ctx.stroke();
      }
    } else if (
      this.dAiState === 'p1_beam_sweep' ||
      this.dAiState === 'p2_beam_sweep' ||
      this.dAiState === 'ld_xbeam_sweep' ||
      this.dAiState === 'ld_finisher_breath'
    ) {
      const isP2 = this.dAiState !== 'p1_beam_sweep';
      const mouth = this.getDragonMouthOrChestPos();
      const len = isP2 ? 415 : 220;
      const angles =
        this.dAiState === 'ld_xbeam_sweep'
          ? [this.dBeamCurrentAngle, this.ldXBeamAngle2]
          : [this.dBeamCurrentAngle];

      for (const ang of angles) {
        const endX = mouth.x + Math.cos(ang) * len;
        const endY = mouth.y + Math.sin(ang) * len;

        ctx.strokeStyle = isP2 ? '#DC2626' : '#2252C9';
        ctx.lineWidth = this.dAiState === 'ld_xbeam_sweep' ? 22 : isP2 ? 30 : 9;
        ctx.beginPath();
        ctx.moveTo(Math.round(mouth.x), Math.round(mouth.y));
        ctx.lineTo(Math.round(endX), Math.round(endY));
        ctx.stroke();

        ctx.strokeStyle = isP2 ? '#F97316' : '#66F2FF';
        ctx.lineWidth = this.dAiState === 'ld_xbeam_sweep' ? 12 : isP2 ? 17 : 5;
        ctx.beginPath();
        ctx.moveTo(Math.round(mouth.x), Math.round(mouth.y));
        ctx.lineTo(Math.round(endX), Math.round(endY));
        ctx.stroke();

        ctx.strokeStyle = isP2 ? '#FEF08A' : '#FFFFFF';
        ctx.lineWidth = isP2 ? 5 : 2;
        ctx.beginPath();
        ctx.moveTo(Math.round(mouth.x), Math.round(mouth.y));
        ctx.lineTo(Math.round(endX), Math.round(endY));
        ctx.stroke();
      }
    }

    // Sky-Fall Meteor Cataclysm Impact Beacon
    if (this.dAiState === 'ld_skyfall_rise' || this.dAiState === 'ld_skyfall_crash') {
      const tx = Math.round(this.ldSkyTargetX);
      const ty = Math.round(getBaseFloorYAt(tx));
      const flash = Math.floor(this.elapsed * 24) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(250, 204, 21, 0.34)' : 'rgba(239, 68, 68, 0.34)';
      ctx.fillRect(tx - 18, ty - 160, 36, 160);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(tx - 24, ty - 3, 48, 3);
    }

    // Lingering Infernal Flame Patches
    for (const fp of this.flamePatches) {
      const fx = Math.round(fp.x - fp.w / 2);
      const fy = Math.round(fp.y);
      const flicker = Math.floor(this.elapsed * 18) % 2 === 0;
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(fx, fy - 3, fp.w, 3);
      ctx.fillStyle = flicker ? '#F97316' : '#EA580C';
      ctx.fillRect(fx + 2, fy - 5, fp.w - 4, 3);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(fx + 5, fy - 6, Math.max(4, fp.w - 10), 2);
    }

    // Erupting Flame Pillars (telegraph fissure + tall scorching column)
    for (const fp of this.flamePillars) {
      const fx = Math.round(fp.x);
      const fy = Math.round(fp.y);
      const flicker = Math.floor(this.elapsed * 22) % 2 === 0;
      if (fp.warnTimer > 0) {
        ctx.fillStyle = flicker ? '#FDE047' : '#EA580C';
        ctx.fillRect(fx - 12, fy - 3, 24, 3);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.fillRect(fx - 2, fy - 80, 4, 80);
      } else {
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(fx - 11, fy - 100, 22, 100);
        ctx.fillStyle = flicker ? '#F97316' : '#EA580C';
        ctx.fillRect(fx - 7, fy - 104, 14, 104);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(fx - 3, fy - 108, 6, 108);
      }
    }

    // Hovering Ember Trap Orbs
    for (const orb of this.emberOrbs) {
      const ox = Math.round(orb.x);
      const oy = Math.round(orb.y);
      const urgent = orb.fuse < 0.65 && Math.floor(this.elapsed * 22) % 2 === 0;
      ctx.fillStyle = '#1A070B';
      ctx.fillRect(ox - 6, oy - 6, 12, 12);
      ctx.fillStyle = urgent ? '#FFFFFF' : '#DC2626';
      ctx.fillRect(ox - 5, oy - 5, 10, 10);
      ctx.fillStyle = urgent ? '#FEF08A' : '#F97316';
      ctx.fillRect(ox - 3, oy - 3, 6, 6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(ox - 1, oy - 1, 2, 2);
    }

    // Molten Tail Arcing Flame Waves & Tall Magma Walls
    for (const bw of this.bossWaves) {
      const wx = Math.round(bw.x);
      const wy = Math.round(bw.y);
      if (bw.tall) {
        const flicker = Math.floor(this.elapsed * 22) % 2 === 0;
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(wx - 7, wy - 54, 14, 54);
        ctx.fillStyle = flicker ? '#F97316' : '#EA580C';
        ctx.fillRect(wx - 4, wy - 50, 8, 50);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(wx - 2, wy - 44, 4, 44);
      } else {
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(wx - 4, wy - 11, 8, 22);
        ctx.fillStyle = '#F97316';
        ctx.fillRect(wx - 2, wy - 9, 4, 18);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(wx - 1, wy - 6, 2, 12);
      }
    }

    // Thunder Fury Lightning Bolts
    for (const bolt of this.lightningQueue) {
      if (bolt.struck && bolt.flashLife > 0) {
        const bx = Math.round(bolt.x);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(bx - 4, 40, 8, 240);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bx - 2, 40, 4, 240);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 1, 40, 2, 240);
      }
    }

    // Meteor Slash / Blade Flurry Waves
    for (const sw of this.slashWaves) {
      const sx = Math.round(sw.x);
      const sy = Math.round(sw.y);
      ctx.fillStyle = this.activeBuff === 'blade_flurry' ? '#38BDF8' : '#F97316';
      ctx.fillRect(sx - 3, sy - 9, 6, 18);
      ctx.fillStyle = this.activeBuff === 'blade_flurry' ? '#E0F2FE' : '#FDE047';
      ctx.fillRect(sx - 2, sy - 7, 4, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(sx - 1, sy - 5, 2, 10);
    }

    if (this.slashSmear.active) {
      const p = 1 - this.slashSmear.life / this.slashSmear.maxLife;
      const sx = Math.round(this.slashSmear.x);
      const sy = Math.round(this.slashSmear.y);
      const step = this.slashSmear.comboStep;
      const spec = WEAPON_SPECS[this.slashSmear.weapon];

      const outerColor = this.wAwakened
        ? '#F97316'
        : this.slashSmear.isCrit
          ? '#ffd147'
          : spec.smearColor;
      const innerColor = this.wAwakened ? '#FEF08A' : '#ffffff';

      if (spec.isThrust) {
        const len = Math.round(spec.reach * (0.75 + 0.25 * (1 - p)));
        ctx.fillStyle = outerColor;
        ctx.fillRect(this.slashSmear.facing === 1 ? sx : sx - len, sy - 2, len, 4);
        if (p < 0.65) {
          ctx.fillStyle = innerColor;
          ctx.fillRect(this.slashSmear.facing === 1 ? sx + 2 : sx - len + 2, sy - 1, len - 4, 2);
        }
      } else {
        const arcSpan = step === 3 ? spec.arcSpan + 2 : spec.arcSpan;
        const reachScale = Math.min(1, spec.reach / 22);
        for (let i = -arcSpan; i <= arcSpan; i++) {
          const curve =
            Math.round((arcSpan - Math.abs(i)) * 0.68 * reachScale) * this.slashSmear.facing;
          const yOff = step === 2 ? -i : i;
          ctx.fillStyle = outerColor;
          ctx.fillRect(sx + curve, sy + yOff, step === 3 ? 3 : 2, 2);
          if (p < 0.65) {
            ctx.fillStyle = innerColor;
            ctx.fillRect(sx + curve + this.slashSmear.facing, sy + yOff, 1, 1);
          }
        }
      }
    }

    for (const sw of this.shockwaves) {
      const r = Math.round(sw.radius);
      ctx.fillStyle = sw.color;
      ctx.fillRect(Math.round(sw.x - r), Math.round(sw.y - 3), 5, 3);
      ctx.fillRect(Math.round(sw.x + r - 5), Math.round(sw.y - 3), 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(sw.x - r + 2), Math.round(sw.y - 5), 2, 2);
      ctx.fillRect(Math.round(sw.x + r - 4), Math.round(sw.y - 5), 2, 2);
    }

    for (const sh of this.shards) {
      const fx = Math.round(sh.x);
      const fy = Math.round(sh.y);
      ctx.fillStyle = sh.fiery ? '#1A070B' : '#24112B';
      ctx.fillRect(fx - 5, fy - 4, 10, 8);
      ctx.fillStyle = sh.reflected ? '#f59e0b' : sh.fiery ? '#DC2626' : '#2252C9';
      ctx.fillRect(fx - 4, fy - 3, 8, 6);
      ctx.fillStyle = sh.reflected ? '#ffd147' : sh.fiery ? '#F97316' : '#66F2FF';
      ctx.fillRect(fx - 3, fy - 2, 6, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - 1, fy - 1, 2, 2);
    }

    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }

    for (const ft of this.floatingTexts) {
      this.drawPixelNumber(ctx, Math.round(ft.x), Math.round(ft.y), ft.text, ft.color, ft.scale);
    }
  }

  private drawPixelNumber(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    y: number,
    text: string,
    color: string,
    scale = 2
  ): void {
    const charW = 4 * scale;
    const totalW = text.length * charW;
    let cursorX = centerX - Math.floor(totalW / 2);

    for (const ch of text) {
      const glyph = PIXEL_GLYPHS[ch];
      if (!glyph) continue;
      ctx.fillStyle = '#140c16';
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy][gx] === '1') {
            ctx.fillRect(cursorX + gx * scale - 1, y + gy * scale, scale + 2, scale + 1);
            ctx.fillRect(cursorX + gx * scale, y + gy * scale - 1, scale, scale + 2);
          }
        }
      }
      ctx.fillStyle = color;
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy][gx] === '1') {
            ctx.fillRect(cursorX + gx * scale, y + gy * scale, scale, scale);
          }
        }
      }
      cursorX += charW;
    }
  }
}
