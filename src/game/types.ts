export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Language = 'ar' | 'en';

export type Winner = 'warrior' | 'dragon' | null;

export type WeaponType =
  | 'broadsword'
  | 'daggers'
  | 'spear'
  | 'axe'
  | 'katana'
  | 'mace';

export type SuperSkillType =
  | 'lightning_dash'
  | 'meteor_slam'
  | 'parry_nova'
  | 'blade_flurry';

export const WEAPON_LIST: WeaponType[] = [
  'broadsword',
  'daggers',
  'spear',
  'axe',
  'katana',
  'mace',
];

export const SUPER_SKILL_LIST: SuperSkillType[] = [
  'lightning_dash',
  'meteor_slam',
  'parry_nova',
  'blade_flurry',
];

export const BATTLE_CONFIG = {
  warriorBaseHp: 250,
  warriorAwakenedHp: 500,
  warriorDmg: 20,
  warriorHeal: 45,
  maxHealCharges: 5,
  healCooldownSec: 1.2,
  dashCooldownSec: 0.6,
  parryCooldownSec: 0.72,
  dragonMaxHp: 400,
  dragonPhase2MaxHp: 1500,
  dragonDmg: 24,
  dragonPhase2Dmg: 36,
  dragonLastDanceDmg: 42,
  weaponDropIntervalSec: 10,
  superSkillIntervalSec: 20,
} as const;

export type CombatEvent =
  | { type: 'ready' }
  | { type: 'warrior_attack'; hp: number; dmg: number; crit: boolean }
  | { type: 'warrior_parry' }
  | { type: 'warrior_heal'; hp: number; chargesLeft: number }
  | { type: 'dragon_attack'; hp: number; dmg: number }
  | { type: 'weapon_swap'; weapon: WeaponType }
  | { type: 'super_skill'; skill: SuperSkillType }
  | { type: 'dragon_fakeout' }
  | { type: 'dragon_phase2' }
  | { type: 'warrior_awakening' }
  | { type: 'dragon_furious' }
  | { type: 'last_dance' };

export interface HudSnapshot {
  warriorHp: number;
  warriorMaxHp: number;
  warriorShield: number;
  warriorAwakened: boolean;
  healCharges: number;
  maxHealCharges: number;
  dragonHp: number;
  dragonMaxHp: number;
  healCooldown: number;
  dashCooldown: number;
  parryCooldown: number;
  comboStep: number;
  weapon: WeaponType;
  nextDropIn: number;
  activeDropWeapon: WeaponType | null;
  nextSkillIn: number;
  activeSkillDrop: SuperSkillType | null;
  activeBuff: SuperSkillType | null;
  activeBuffTimer: number;
  maxJumps: number;
  dragonStunned: boolean;
  dragonPhase2: boolean;
  dragonFurious: boolean;
  dragonTransforming: boolean;
  lastDanceCinematic: boolean;
  lastDanceBannerActive: boolean;
  lastDanceMode: boolean;
  cutsceneActive: boolean;
  lastEvent: CombatEvent;
}

export interface BattleSummary {
  winner: Winner;
  durationSec: number;
  durationMs: number;
  damageDealt: number;
  damageTaken: number;
  totalHealed: number;
  attacksLanded: number;
  critsLanded: number;
  parriesLanded: number;
}
