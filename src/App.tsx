import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Code2,
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CppCodePanel } from './components/CppCodePanel';
import { LeaderboardPortal } from './components/LeaderboardPortal';
import { PlayerRegistrationModal } from './components/PlayerRegistrationModal';
import { auth, googleProvider } from './firebase';
import { PixelBattleEngine } from './game/engine';
import { sound } from './game/sound';
import {
  BATTLE_CONFIG,
  type BattleSummary,
  type CombatEvent,
  type GameState,
  type HudSnapshot,
  type Language,
} from './game/types';
import {
  formatDurationMs,
  generateLocalPlayerId,
  loadActiveSession,
  loadLocalMatches,
  loadLocalProfile,
  recordLocalMatchOutcome,
  recordOnlineMatchOutcome,
  registerOrUpdateOnlinePlayer,
  saveActiveSession,
  saveLocalProfile,
  sortLeaderboardPlayers,
  subscribeLeaderboard,
  subscribeRecentMatches,
  type ActivePlayerSession,
  type MatchRunRecord,
  type PlayerProfileRecord,
} from './services/leaderboard';

const COPY = {
  ar: {
    dir: 'rtl' as const,
    brand: 'ذا فاينل بوس تو هافن',
    swapBtn: 'تبديل الجانبين',
    expandBtn: 'تكبير اللعبة',
    collapseBtn: 'إظهار الترتيب',
    boardPaneBtn: 'الترتيب المباشر',
    codePaneBtn: 'كود C++',
    crtBtn: 'CRT',
    registerPlayerBtn: 'تسجيل لاعب',
    gamePaneLabel: 'لعبة HTML5 ثنائية الأبعاد',
    titleName: 'The Final Boss to Heaven',
    startBtn: 'ابدأ المعركة',
    playingAsLabel: (name: string) => `تلعب باسم: ${name}`,
    controlsHint:
      'A/D حركة · W/Space قفز · S انقضاض · J/نقر هجوم · Q/كلك يمين صد · Shift دحرجة · E التقاط سلاح أو مهارة · H علاج',
    warriorName: 'المحارب',
    dragonName: 'التنين المدرع',
    stunnedTag: 'مذهول!',
    fakeoutTag: 'ينهض...',
    phase2Tag: 'المرحلة النارية 2!',
    awakenedTag: 'صحوة اللهب!',
    furiousTag: 'التنين غاضب!',
    lastDanceTag: 'الرقصة الأخيرة!',
    attackBtn: 'هجوم',
    parryBtn: 'صد',
    healBtn: 'علاج',
    dashBtn: 'دحرجة',
    weaponLabel: {
      broadsword: 'سيف عريض',
      daggers: 'خناجر توأم',
      spear: 'رمح حربي',
      axe: 'فأس قتالي',
      katana: 'كاتانا',
      mace: 'مطرقة شائكة',
    },
    skillLabel: {
      lightning_dash: 'اندفاع البرق',
      meteor_slam: 'نيزك الساحق',
      parry_nova: 'صدّ الانفجار',
      blade_flurry: 'عاصفة النصال',
    },
    skillTitle: 'مهارة خارقة',
    skillInLabel: (sec: number) => `مهارة: ${sec}ث`,
    skillActiveLabel: 'مهارة بالساحة!',
    dropInLabel: (sec: number) => `سلاح: ${sec}ث`,
    dropActiveLabel: 'سلاح بالساحة!',
    tripleJumpTag: '3 قفزات',
    noHealsLeft: '0/5 فارغ',
    shieldTag: 'درع',
    ready: 'جاهز',
    dmgLabel: 'الضرر',
    hpLabel: 'HP',
    pausedTitle: 'اللعبة متوقفة',
    resumeBtn: 'استئناف',
    restartBtn: 'إعادة المعركة',
    titleMenuBtn: 'القائمة الرئيسية',
    warriorWins: 'فاز المحارب! (انتصار)',
    dragonWins: 'فاز التنين! (هزيمة)',
    timeStat: 'المدة',
    dealtStat: 'الضرر المُوجّه',
    critsStat: 'ضربات حرجة',
    parriesStat: 'صد مثالي',
    recordedOnlineTag: 'تم تسجيل النتيجة في الترتيب العالمي المباشر',
    recordedLocalTag: 'تم حفظ النتيجة محلياً لهذه الجلسة',
    syncResultOnlineBtn: 'سجّل بحساب Google لحفظ نقاطك عالمياً',
    playAgain: 'العب مجدداً',
    readyLog: 'اضرب التنين عن قرب، صدّ هجومه بـ Q، لديك 5 علاجات فقط طوال المعركة!',
    warriorAttacksLog: (hp: number, dmg: number, crit: boolean) =>
      crit
        ? `ضربة حرجة (-${dmg}!) ضد التنين (HP: ${hp})`
        : `المحارب يصيب التنين (-${dmg}) (HP: ${hp})`,
    warriorParryLog: 'صد مثالي! تم إذهال التنين!',
    warriorHealsLog: (hp: number, chargesLeft: number) =>
      `المحارب يعالج +${BATTLE_CONFIG.warriorHeal}! (HP: ${hp} · المتبقي ${chargesLeft}/5)`,
    dragonAttacksLog: (hp: number, dmg: number) => `التنين يصيب المحارب (-${dmg})! (HP: ${hp})`,
    weaponSwapLog: (name: string) => `تم التبديل إلى: ${name}!`,
    superSkillLog: (name: string) => `تم تفعيل المهارة الخارقة: ${name}!`,
    fakeoutLog: 'تحطم التنين على الأرض... لكنه ينهض بنيران المرحلة الثانية!',
    phase2Log: 'انفجار المرحلة الثانية! التنين عاد بـ 1500 HP — فُتح القفز الثلاثي!',
    awakeningLog: 'صحوة المحارب! عاد بـ 500 HP وهالة نارية خارقة!',
    furiousLog: 'زأر التنين بغضب عارم وزادت قوته وسرعته!',
    lastDanceLog: 'الرقصة الأخيرة! التنين يطلق كامل طاقته الـ 20!',
    pauseAria: 'إيقاف مؤقت',
    muteAria: 'كتم أو تشغيل الصوت',
  },
  en: {
    dir: 'ltr' as const,
    brand: 'THE FINAL BOSS TO HEAVEN',
    swapBtn: 'Swap Sides',
    expandBtn: 'Expand Game',
    collapseBtn: 'Show Sidebar',
    boardPaneBtn: 'Live Board',
    codePaneBtn: 'C++ Code',
    crtBtn: 'CRT',
    registerPlayerBtn: 'Register Name',
    gamePaneLabel: 'HTML5 2D Pixel Game',
    titleName: 'The Final Boss to Heaven',
    startBtn: 'Start Battle',
    playingAsLabel: (name: string) => `Playing as: ${name}`,
    controlsHint:
      'A/D Move · W/Space Jump · S Dive Slam · J/Click Combo · Q/Right-Click Parry · Shift Roll · E Pickup · H Heal',
    warriorName: 'Warrior',
    dragonName: 'Armored Wyvern',
    stunnedTag: 'STUNNED!',
    fakeoutTag: 'AWAKENING!',
    phase2Tag: 'INFERNAL PHASE 2!',
    awakenedTag: 'FLAME AWAKENED!',
    furiousTag: 'FURIOUS RAGE!',
    lastDanceTag: 'THE LAST DANCE!',
    attackBtn: 'Combo',
    parryBtn: 'Parry',
    healBtn: 'Heal',
    dashBtn: 'Roll',
    weaponLabel: {
      broadsword: 'Broadsword',
      daggers: 'Twin Daggers',
      spear: 'Spear',
      axe: 'Battle Axe',
      katana: 'Katana',
      mace: 'Heavy Mace',
    },
    skillLabel: {
      lightning_dash: 'Lightning Dash',
      meteor_slam: 'Meteor Slam',
      parry_nova: 'Parry Counter-Nova',
      blade_flurry: 'Blade Flurry',
    },
    skillTitle: 'Super Skill',
    skillInLabel: (sec: number) => `Skill: ${sec}s`,
    skillActiveLabel: 'Skill Orb!',
    dropInLabel: (sec: number) => `Drop: ${sec}s`,
    dropActiveLabel: 'Drop Active!',
    tripleJumpTag: '3x JUMP',
    noHealsLeft: '0/5 EMPTY',
    shieldTag: 'SHIELD',
    ready: 'READY',
    dmgLabel: 'DMG',
    hpLabel: 'HP',
    pausedTitle: 'Paused',
    resumeBtn: 'Resume',
    restartBtn: 'Restart Battle',
    titleMenuBtn: 'Title Screen',
    warriorWins: 'Warrior Wins! (Victory)',
    dragonWins: 'Dragon Wins! (Defeat)',
    timeStat: 'Time',
    dealtStat: 'Damage Dealt',
    critsStat: 'Critical Hits',
    parriesStat: 'Perfect Parries',
    recordedOnlineTag: 'Synced to Live Global Leaderboard',
    recordedLocalTag: 'Recorded in Local Session Feed',
    syncResultOnlineBtn: 'Sign in with Google to Sync Globally',
    playAgain: 'Play Again',
    readyLog: 'Strike close-range, parry with Q — only 5 healing charges for the whole fight!',
    warriorAttacksLog: (hp: number, dmg: number, crit: boolean) =>
      crit
        ? `CRITICAL HIT (-${dmg}!) on Dragon (HP: ${hp})`
        : `Warrior hits Dragon (-${dmg}) (HP: ${hp})`,
    warriorParryLog: 'PERFECT PARRY! Dragon stunned!',
    warriorHealsLog: (hp: number, chargesLeft: number) =>
      `Warrior heals +${BATTLE_CONFIG.warriorHeal}! (HP: ${hp} · ${chargesLeft}/5 left)`,
    dragonAttacksLog: (hp: number, dmg: number) => `Dragon hits Warrior (-${dmg})! (HP: ${hp})`,
    weaponSwapLog: (name: string) => `Swapped weapon to ${name}!`,
    superSkillLog: (name: string) => `Activated Super Skill: ${name}!`,
    fakeoutLog: 'The Wyvern crashes to the ground... then awakens in Infernal Fire!',
    phase2Log: 'INFERNAL PHASE 2 (1500 HP)! Triple Jump unlocked!',
    awakeningLog: 'SECOND WIND! Warrior rises in flames (500 HP)!',
    furiousLog: 'THE WYVERN ROARS IN FURY! Boss power & speed surged!',
    lastDanceLog: 'THE LAST DANCE! All 20 Apex Wyvern moves unleashed!',
    pauseAria: 'Pause game',
    muteAria: 'Toggle sound',
  },
};

function WarriorPixelIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-5 h-5 pixelated shrink-0" aria-hidden="true">
      <rect x="5" y="1" width="6" height="3" fill="#fff4d6" />
      <rect x="4" y="2" width="2" height="3" fill="#b4bfe0" />
      <rect x="5" y="4" width="6" height="3" fill="#ffd2ab" />
      <rect x="6" y="5" width="1" height="1" fill="#1b102b" />
      <rect x="9" y="5" width="1" height="1" fill="#1b102b" />
      <rect x="4" y="7" width="8" height="3" fill="#fff4d6" />
      <rect x="3" y="9" width="3" height="5" fill="#4ba39f" />
      <rect x="5" y="10" width="6" height="4" fill="#a86c43" />
      <rect x="7" y="11" width="2" height="1" fill="#ffd25a" />
    </svg>
  );
}

function DragonPixelIcon({ phase2 = false }: { phase2?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="w-5 h-5 pixelated shrink-0" aria-hidden="true">
      <rect x="2" y="1" width="2" height="4" fill={phase2 ? '#1d0b24' : '#32154f'} />
      <rect x="12" y="1" width="2" height="4" fill={phase2 ? '#1d0b24' : '#32154f'} />
      <rect x="3" y="4" width="10" height="6" fill={phase2 ? '#cf2144' : '#fff1d4'} />
      <rect x="4" y="5" width="2" height="1" fill={phase2 ? '#ff9e3b' : '#8a4cf0'} />
      <rect x="10" y="5" width="2" height="1" fill={phase2 ? '#ff9e3b' : '#8a4cf0'} />
      <rect x="5" y="6" width="2" height="2" fill={phase2 ? '#fff08a' : '#75f5ff'} />
      <rect x="9" y="6" width="2" height="2" fill={phase2 ? '#fff08a' : '#75f5ff'} />
      <rect x="4" y="10" width="8" height="4" fill={phase2 ? '#632036' : '#d4bfd1'} />
      <rect x="6" y="11" width="4" height="3" fill={phase2 ? '#ff7b24' : '#75f5ff'} />
      <rect x="7" y="11" width="2" height="2" fill="#fff7d6" />
    </svg>
  );
}

function TitleCrestSvg() {
  return (
    <svg viewBox="0 0 48 24" className="w-20 h-10 pixelated mx-auto" aria-hidden="true">
      <rect x="20" y="3" width="8" height="14" fill="#22426b" />
      <rect x="21" y="4" width="6" height="12" fill="#3b6ea5" />
      <rect x="23" y="5" width="2" height="10" fill="#f5b942" />
      <rect x="22" y="8" width="4" height="2" fill="#f5b942" />
      <rect x="13" y="4" width="2" height="2" fill="#d4dde8" />
      <rect x="15" y="6" width="2" height="2" fill="#d4dde8" />
      <rect x="17" y="8" width="2" height="2" fill="#d4dde8" />
      <rect x="29" y="12" width="2" height="2" fill="#f5b942" />
      <rect x="31" y="14" width="2" height="2" fill="#5c3c28" />
      <rect x="33" y="4" width="2" height="2" fill="#d4dde8" />
      <rect x="31" y="6" width="2" height="2" fill="#d4dde8" />
      <rect x="29" y="8" width="2" height="2" fill="#d4dde8" />
      <rect x="17" y="12" width="2" height="2" fill="#f5b942" />
      <rect x="15" y="14" width="2" height="2" fill="#5c3c28" />
      <rect x="22" y="1" width="4" height="2" fill="#f57e25" />
      <rect x="23" y="0" width="2" height="2" fill="#ffd147" />
    </svg>
  );
}

function formatCombatEvent(event: CombatEvent, t: typeof COPY.ar | typeof COPY.en): string {
  switch (event.type) {
    case 'ready':
      return t.readyLog;
    case 'warrior_attack':
      return t.warriorAttacksLog(event.hp, event.dmg, event.crit);
    case 'warrior_parry':
      return t.warriorParryLog;
    case 'warrior_heal':
      return t.warriorHealsLog(event.hp, event.chargesLeft);
    case 'dragon_attack':
      return t.dragonAttacksLog(event.hp, event.dmg);
    case 'weapon_swap':
      return t.weaponSwapLog(t.weaponLabel[event.weapon]);
    case 'super_skill':
      return t.superSkillLog(t.skillLabel[event.skill]);
    case 'dragon_fakeout':
      return t.fakeoutLog;
    case 'dragon_phase2':
      return t.phase2Log;
    case 'warrior_awakening':
      return t.awakeningLog;
    case 'dragon_furious':
      return t.furiousLog;
    case 'last_dance':
      return t.lastDanceLog;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PixelBattleEngine | null>(null);

  const [lang, setLang] = useState<Language>('en');
  const [muted, setMuted] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [expandedGame, setExpandedGame] = useState(false);
  const [swapSides, setSwapSides] = useState(false);
  const [sidePanel, setSidePanel] = useState<'leaderboard' | 'code'>('leaderboard');
  const [gameState, setGameState] = useState<GameState>('TITLE');

  // Player Identity & Online Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<ActivePlayerSession | null>(() =>
    loadActiveSession(),
  );
  const [regModalOpen, setRegModalOpen] = useState<boolean>(() => !loadActiveSession());
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Live Firestore Leaderboard & Local Session State
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerProfileRecord[]>([]);
  const [onlineMatches, setOnlineMatches] = useState<MatchRunRecord[]>([]);
  const [localProfile, setLocalProfile] = useState<PlayerProfileRecord | null>(() =>
    loadLocalProfile(),
  );
  const [localMatches, setLocalMatches] = useState<MatchRunRecord[]>(() => loadLocalMatches());
  const [boardLoading, setBoardLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>({
    warriorHp: BATTLE_CONFIG.warriorBaseHp,
    warriorMaxHp: BATTLE_CONFIG.warriorBaseHp,
    warriorShield: 0,
    warriorAwakened: false,
    healCharges: BATTLE_CONFIG.maxHealCharges,
    maxHealCharges: BATTLE_CONFIG.maxHealCharges,
    dragonHp: BATTLE_CONFIG.dragonMaxHp,
    dragonMaxHp: BATTLE_CONFIG.dragonMaxHp,
    healCooldown: 0,
    dashCooldown: 0,
    parryCooldown: 0,
    comboStep: 0,
    weapon: 'broadsword',
    nextDropIn: BATTLE_CONFIG.weaponDropIntervalSec,
    activeDropWeapon: null,
    nextSkillIn: BATTLE_CONFIG.superSkillIntervalSec,
    activeSkillDrop: null,
    activeBuff: null,
    activeBuffTimer: 0,
    maxJumps: 2,
    dragonStunned: false,
    dragonPhase2: false,
    dragonTransforming: false,
    dragonFurious: false,
    lastDanceCinematic: false,
    lastDanceBannerActive: false,
    lastDanceMode: false,
    lastEvent: { type: 'ready' },
  });

  const [summary, setSummary] = useState<BattleSummary>({
    winner: null,
    durationSec: 0,
    durationMs: 0,
    damageDealt: 0,
    damageTaken: 0,
    totalHealed: 0,
    attacksLanded: 0,
    critsLanded: 0,
    parriesLanded: 0,
  });

  const t = COPY[lang];

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time Firestore Leaderboard & Recent Matches Feed
  useEffect(() => {
    let playersReady = false;
    let matchesReady = false;
    const markReady = () => {
      if (playersReady && matchesReady) setBoardLoading(false);
    };

    const unsubPlayers = subscribeLeaderboard(
      (players) => {
        setOnlinePlayers(players);
        setSyncError(null);
        playersReady = true;
        markReady();
      },
      (err) => {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          setSyncError(parsed?.error || err.message);
        } catch {
          setSyncError(err.message);
        }
        playersReady = true;
        markReady();
      },
    );

    const unsubMatches = subscribeRecentMatches(
      (matches) => {
        setOnlineMatches(matches);
        setSyncError(null);
        matchesReady = true;
        markReady();
      },
      (err) => {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          setSyncError(parsed?.error || err.message);
        } catch {
          setSyncError(err.message);
        }
        matchesReady = true;
        markReady();
      },
    );

    return () => {
      unsubPlayers();
      unsubMatches();
    };
  }, []);

  // Reconcile signed-in user's existing Firestore profile into activeSession
  useEffect(() => {
    if (!firebaseUser) return;
    const matched = onlinePlayers.find((p) => p.uid === firebaseUser.uid);
    if (matched) {
      setActiveSession((prev) => {
        if (
          prev &&
          prev.mode === 'online' &&
          prev.playerId === matched.uid &&
          prev.playerName === matched.playerName
        ) {
          return prev;
        }
        const next: ActivePlayerSession = {
          playerId: matched.uid,
          playerName: matched.playerName,
          mode: 'online',
        };
        saveActiveSession(next);
        return next;
      });
      setRegModalOpen(false);
    }
  }, [firebaseUser, onlinePlayers]);

  // Combined Leaderboard & Feed (includes local session record clearly tagged when in local mode)
  const displayedPlayers = useMemo(() => {
    if (activeSession?.mode === 'local' && localProfile && localProfile.uid === activeSession.playerId) {
      const merged = [localProfile, ...onlinePlayers.filter((p) => p.uid !== localProfile.uid)];
      return sortLeaderboardPlayers(merged);
    }
    return onlinePlayers;
  }, [activeSession, localProfile, onlinePlayers]);

  const displayedMatches = useMemo(() => {
    if (activeSession?.mode === 'local' && localMatches.length > 0) {
      return [...localMatches, ...onlineMatches]
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 30);
    }
    return onlineMatches;
  }, [activeSession, localMatches, onlineMatches]);

  // Keep latest match-recording handler in a ref so the canvas engine callback never sees stale state
  const handleBattleEndRef = useRef<(battleSummary: BattleSummary) => void>(() => {});
  handleBattleEndRef.current = (battleSummary: BattleSummary) => {
    setSummary(battleSummary);
    setGameState('GAME_OVER');

    if (!activeSession || !battleSummary.winner) return;

    if (activeSession.mode === 'online' && auth.currentUser) {
      setIsSubmittingMatch(true);
      setSyncError(null);
      void recordOnlineMatchOutcome({
        uid: auth.currentUser.uid,
        playerName: activeSession.playerName,
        summary: battleSummary,
      })
        .catch((err) => {
          const raw = err instanceof Error ? err.message : 'Failed to sync match result.';
          try {
            const parsed = JSON.parse(raw) as { error?: string };
            setSyncError(parsed?.error || raw);
          } catch {
            setSyncError(raw);
          }
        })
        .finally(() => {
          setIsSubmittingMatch(false);
        });
    } else {
      const updated = recordLocalMatchOutcome(activeSession, battleSummary);
      setLocalProfile(updated.profile);
      setLocalMatches(updated.matches);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PixelBattleEngine(canvas, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onBattleEnd: (battleSummary) => {
        handleBattleEndRef.current(battleSummary);
      },
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setTitleMode(gameState === 'TITLE');
    engine.setPaused(gameState === 'PAUSED');
  }, [gameState]);

  const handleOnlineRegister = useCallback(
    async (cleanedName: string) => {
      setIsRegistering(true);
      setRegError(null);
      try {
        let user = auth.currentUser;
        if (!user) {
          const cred = await signInWithPopup(auth, googleProvider);
          user = cred.user;
        }
        const savedName = await registerOrUpdateOnlinePlayer(
          user.uid,
          cleanedName,
          onlinePlayers,
        );
        const session: ActivePlayerSession = {
          playerId: user.uid,
          playerName: savedName,
          mode: 'online',
        };
        saveActiveSession(session);
        setActiveSession(session);
        setRegModalOpen(false);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Unable to register player.';
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          setRegError(parsed?.error || raw);
        } catch {
          setRegError(raw);
        }
      } finally {
        setIsRegistering(false);
      }
    },
    [onlinePlayers],
  );

  const handleLocalRegister = useCallback(
    (cleanedName: string) => {
      const existingId =
        activeSession?.mode === 'local' ? activeSession.playerId : generateLocalPlayerId();
      const session: ActivePlayerSession = {
        playerId: existingId,
        playerName: cleanedName,
        mode: 'local',
      };
      const now = Date.now();
      const currentLocal =
        localProfile && localProfile.uid === existingId
          ? {
              ...localProfile,
              playerName: cleanedName,
              playerNameLower: cleanedName.toLowerCase(),
              updatedAtMs: now,
            }
          : {
              uid: existingId,
              playerName: cleanedName,
              playerNameLower: cleanedName.toLowerCase(),
              dragonKills: 0,
              matchesPlayed: 0,
              wins: 0,
              losses: 0,
              bestTimeMs: null,
              lastOutcome: 'none' as const,
              lastDurationMs: 0,
              createdAtMs: now,
              updatedAtMs: now,
              isLocal: true,
            };
      saveActiveSession(session);
      saveLocalProfile(currentLocal);
      setActiveSession(session);
      setLocalProfile(currentLocal);
      setRegError(null);
      setRegModalOpen(false);
    },
    [activeSession, localProfile],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      if (!next) sound.playUiTick();
      return next;
    });
  }, []);

  const toggleLang = useCallback(() => {
    sound.playUiTick();
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const startNewBattle = useCallback(() => {
    if (!activeSession) {
      setRegModalOpen(true);
      return;
    }
    sound.playUiTick();
    engineRef.current?.resetBattle();
    setSummary({
      winner: null,
      durationSec: 0,
      durationMs: 0,
      damageDealt: 0,
      damageTaken: 0,
      totalHealed: 0,
      attacksLanded: 0,
      critsLanded: 0,
      parriesLanded: 0,
    });
    setGameState('PLAYING');
    window.requestAnimationFrame(() => {
      gameStageRef.current?.focus({ preventScroll: true });
    });
  }, [activeSession]);

  const returnToTitle = useCallback(() => {
    sound.playUiTick();
    engineRef.current?.resetBattle();
    setSummary({
      winner: null,
      durationSec: 0,
      durationMs: 0,
      damageDealt: 0,
      damageTaken: 0,
      totalHealed: 0,
      attacksLanded: 0,
      critsLanded: 0,
      parriesLanded: 0,
    });
    setGameState('TITLE');
  }, []);

  // Physical e.code controls (guarded when registration modal or text input is active)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (regModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;

      if (code === 'KeyM') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (gameState === 'TITLE' || gameState === 'GAME_OVER') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
          e.preventDefault();
          startNewBattle();
        }
        return;
      }

      if (code === 'Escape') {
        e.preventDefault();
        sound.playUiTick();
        setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
        return;
      }

      if (gameState !== 'PLAYING') return;
      const engine = engineRef.current;
      if (!engine) return;

      if (code === 'KeyA' || code === 'ArrowLeft') {
        e.preventDefault();
        engine.setMoveLeft(true);
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        e.preventDefault();
        engine.setMoveRight(true);
      } else if (code === 'KeyS' || code === 'ArrowDown') {
        e.preventDefault();
        engine.setDownHeld(true);
      } else if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') {
        e.preventDefault();
        if (!e.repeat) engine.triggerJump();
      } else if (code === 'KeyJ' || code === 'KeyF' || code === 'KeyZ' || code === 'Digit1') {
        e.preventDefault();
        if (!e.repeat) engine.triggerAttack();
      } else if (code === 'KeyQ') {
        e.preventDefault();
        if (!e.repeat) engine.triggerParry();
      } else if (code === 'KeyE') {
        e.preventDefault();
        if (!e.repeat) engine.triggerInteractOrParry();
      } else if (code === 'KeyH' || code === 'KeyK' || code === 'Digit2') {
        e.preventDefault();
        if (!e.repeat) engine.triggerHeal();
      } else if (
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyL' ||
        code === 'KeyX'
      ) {
        e.preventDefault();
        if (!e.repeat) engine.triggerDash();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const engine = engineRef.current;
      if (!engine) return;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        engine.setMoveLeft(false);
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        engine.setMoveRight(false);
      } else if (code === 'KeyS' || code === 'ArrowDown') {
        engine.setDownHeld(false);
      } else if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') {
        engine.setJumpHeld(false);
      }
    };

    const onBlur = () => {
      engineRef.current?.clearHeldInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gameState, regModalOpen, startNewBattle, toggleMute]);

  const warriorBarPct = Math.min(100, Math.round((hud.warriorHp / Math.max(1, hud.warriorMaxHp)) * 100));
  const dragonBarPct = Math.min(100, Math.round((hud.dragonHp / Math.max(1, hud.dragonMaxHp)) * 100));
  const isOverhealed = hud.warriorHp > hud.warriorMaxHp;
  const battleLog = formatCombatEvent(hud.lastEvent, t);
  const activeWinner = gameState === 'GAME_OVER' ? summary.winner : null;

  return (
    <div
      dir={t.dir}
      className="min-h-screen lg:h-screen w-full flex flex-col lg:overflow-hidden bg-[#0d0b14] text-[#f4efe6] select-none"
    >
      {/* Top Portal Header */}
      <header className="min-h-12 px-3 sm:px-4 py-1.5 border-b border-[#2a223b] bg-[#13101d] flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-pixel text-xs sm:text-base font-bold tracking-wide text-amber-300 truncate">
            {t.brand}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Active Player Identity Trigger */}
          <button
            type="button"
            onClick={() => {
              setRegError(null);
              setRegModalOpen(true);
            }}
            className="h-8 px-2.5 border border-[#594b78] bg-[#1e1730] hover:border-amber-400 text-xs font-bold text-[#f4efe6] flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            {activeSession?.mode === 'online' ? (
              <Globe className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            )}
            <span className="max-w-[115px] truncate">
              {activeSession ? activeSession.playerName : t.registerPlayerBtn}
            </span>
          </button>

          {!expandedGame && (
            <>
              <button
                type="button"
                onClick={() =>
                  setSidePanel((prev) => (prev === 'leaderboard' ? 'code' : 'leaderboard'))
                }
                className="h-8 px-2.5 border border-[#473d61] bg-[#1d172c] hover:border-amber-400 text-xs font-medium text-[#e8e0f5] flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                {sidePanel === 'leaderboard' ? (
                  <>
                    <Code2 className="w-3.5 h-3.5 text-sky-300" />
                    <span className="hidden sm:inline">{t.codePaneBtn}</span>
                  </>
                ) : (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">{t.boardPaneBtn}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSwapSides((prev) => !prev)}
                className="hidden lg:flex h-8 px-2.5 border border-[#473d61] bg-[#1d172c] hover:border-amber-400 text-xs font-medium text-[#e8e0f5] items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t.swapBtn}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setExpandedGame((prev) => !prev)}
            className="h-8 px-2.5 border border-[#473d61] bg-[#1d172c] hover:border-amber-400 text-xs font-medium text-[#e8e0f5] flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            {expandedGame ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{expandedGame ? t.collapseBtn : t.expandBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => setCrtEnabled((prev) => !prev)}
            aria-pressed={crtEnabled}
            title="Toggle retro CRT scanlines"
            className={`h-8 px-2 border text-[11px] font-mono-num flex items-center gap-1 transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              crtEnabled
                ? 'border-amber-400/70 bg-[#261c36] text-amber-200'
                : 'border-[#473d61] bg-[#1d172c] text-[#9e92b5]'
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span>{t.crtBtn}</span>
          </button>

          <button
            type="button"
            onClick={toggleLang}
            className="h-8 px-2.5 border border-[#473d61] bg-[#1d172c] hover:border-amber-400 text-xs font-pixel text-[#f4efe6] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={t.muteAria}
            className="h-8 w-8 flex items-center justify-center border border-[#473d61] bg-[#1d172c] hover:border-amber-400 text-[#f4efe6] transition-colors duration-150 cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Responsive Portal Grid */}
      <main
        className={`flex-1 min-h-0 p-2.5 sm:p-4 grid gap-3 sm:gap-4 items-stretch ${
          expandedGame
            ? 'grid-cols-1'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]'
        }`}
      >
        {/* Interactive HTML5 2D Pixel Game Arena */}
        <section
          aria-label={t.gamePaneLabel}
          className={`relative min-h-[340px] sm:min-h-[430px] lg:min-h-0 h-full flex flex-col border-2 border-[#352c4a] overflow-hidden bg-[#0d0b14] pixel-frame ${
            !expandedGame && swapSides ? 'lg:order-2' : 'lg:order-1'
          }`}
        >
          {/* Isolated 60Hz Fixed-Timestep Pixel-Art Arena */}
          <div
            ref={gameStageRef}
            tabIndex={0}
            className="relative flex-1 min-h-0 flex items-center justify-center bg-gradient-to-b from-[#293f47] via-[#4a747c] to-[#211F24] outline-none"
            onContextMenu={(e) => {
              if (gameState === 'PLAYING') {
                e.preventDefault();
                engineRef.current?.triggerParry();
              }
            }}
            onPointerDown={(e) => {
              gameStageRef.current?.focus({ preventScroll: true });
              if (gameState === 'PLAYING') {
                if (e.button === 0) {
                  engineRef.current?.triggerAttack();
                } else if (e.button === 2) {
                  engineRef.current?.triggerParry();
                }
              }
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain pixelated"
              aria-label="Warrior vs Dragon pixel battle arena"
            />

            {/* Optional Subtle Retro CRT Scanlines */}
            {crtEnabled && (
              <div
                aria-hidden="true"
                className="retro-scanlines absolute inset-0 z-[5] pointer-events-none opacity-45"
              />
            )}

            {/* TITLE SCREEN OVERLAY */}
            {gameState === 'TITLE' && (
              <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#18282e]/84 via-[#1c3238]/32 to-[#18171c]/88">
                <div className="flex justify-center">
                  {activeSession && (
                    <div className="px-3 py-1 border border-[#4f426e] bg-[#141020]/90 text-xs font-mono-num text-amber-200">
                      {t.playingAsLabel(activeSession.playerName)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center text-center max-w-lg mx-auto px-3">
                  <TitleCrestSvg />
                  <h1
                    className="mt-3 font-pixel text-2xl sm:text-4xl font-bold tracking-wider text-[#f8efe2] drop-shadow-[0_4px_0_#140c16]"
                    style={{ textWrap: 'balance' }}
                  >
                    {t.titleName}
                  </h1>

                  <button
                    type="button"
                    onClick={startNewBattle}
                    className="mt-6 h-11 px-7 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] active:translate-y-0.5 text-white font-bold text-sm sm:text-base tracking-wide pixel-frame transition-transform duration-150 cursor-pointer whitespace-nowrap"
                  >
                    {t.startBtn}
                  </button>
                </div>

                <p className="text-center text-[11px] sm:text-xs text-[#e0d6ec] font-mono-num tracking-wide">
                  {t.controlsHint}
                </p>
              </div>
            )}

            {/* THE LAST DANCE CLIMAX BANNER OVERLAY */}
            {gameState === 'PLAYING' && hud.lastDanceBannerActive && (
              <div
                dir="ltr"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-4"
              >
                <div className="w-full max-w-2xl flex flex-col items-center text-center">
                  <div className="w-3/4 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_14px_rgba(251,191,36,0.9)]" />
                  <h2
                    className="my-2 sm:my-3 font-pixel text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.14em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-[#fff7cc] via-[#fbbf24] to-[#dc2626] drop-shadow-[0_4px_0_#1a0505] select-none animate-pulse"
                    style={{
                      WebkitTextStroke: '1.5px #2a0707',
                      filter: 'drop-shadow(0 0 18px rgba(239,68,68,0.85))',
                    }}
                  >
                    THE LAST DANCE
                  </h2>
                  <div className="w-3/4 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.9)]" />
                </div>
              </div>
            )}

            {/* ACTIVE GAMEPLAY HUD */}
            {gameState !== 'TITLE' && (
              <div
                className={`absolute inset-0 z-10 flex flex-col justify-between pointer-events-none p-2.5 sm:p-4 transition-opacity duration-200 ${
                  hud.lastDanceCinematic ? 'opacity-20' : 'opacity-100'
                }`}
              >
                {/* Top Perimeter Status Clusters */}
                <div
                  dir="ltr"
                  className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3 w-full"
                >
                  {/* Warrior HP */}
                  <div
                    className={`bg-[#161124]/92 border-2 px-2.5 py-1.5 pixel-frame max-w-[245px] ${
                      hud.warriorAwakened ? 'border-amber-400' : 'border-[#473d61]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <WarriorPixelIcon />
                        <span className="font-bold text-xs text-[#f4efe6] truncate">
                          {activeSession?.playerName || t.warriorName}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono-num whitespace-nowrap ${
                          hud.warriorAwakened ? 'text-amber-300 font-bold' : 'text-sky-300'
                        }`}
                      >
                        {hud.warriorAwakened
                          ? `${t.awakenedTag} · ${t.tripleJumpTag}`
                          : hud.dragonPhase2
                            ? t.tripleJumpTag
                            : `${t.dmgLabel}: ${BATTLE_CONFIG.warriorDmg}`}
                      </span>
                    </div>

                    <div className="mt-1 h-3 w-full bg-[#0c0914] border border-[#3a3152] p-0.5 flex gap-0.5">
                      <div
                        className={`h-full transition-all duration-150 ${
                          hud.warriorAwakened
                            ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300'
                            : isOverhealed
                              ? 'bg-emerald-400'
                              : warriorBarPct <= 30
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                        }`}
                        style={{ width: `${warriorBarPct}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] font-mono-num gap-1.5">
                      <span
                        className={
                          hud.warriorAwakened
                            ? 'text-amber-200 font-bold'
                            : isOverhealed
                              ? 'text-emerald-300 font-bold'
                              : 'text-[#e5dcf0]'
                        }
                      >
                        {t.hpLabel}: {hud.warriorHp}/{hud.warriorMaxHp}
                        {hud.warriorShield > 0 && (
                          <span className="ml-1 text-amber-300 font-bold">
                            +{hud.warriorShield}
                          </span>
                        )}
                      </span>
                      <div
                        className="flex items-center gap-0.5"
                        aria-label={`Heal charges ${hud.healCharges} of ${hud.maxHealCharges}`}
                      >
                        {Array.from({ length: hud.maxHealCharges }).map((_, idx) => {
                          const filled = idx < hud.healCharges;
                          return (
                            <span
                              key={idx}
                              className={`inline-block w-2 h-2.5 border ${
                                filled
                                  ? 'bg-emerald-400 border-emerald-200'
                                  : 'bg-[#0c0914] border-[#3a3152]'
                              }`}
                            />
                          );
                        })}
                        <span
                          className={`ml-1 text-[10px] font-bold ${
                            hud.healCharges > 0 ? 'text-emerald-300' : 'text-rose-400'
                          }`}
                        >
                          {hud.healCharges}/{hud.maxHealCharges}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center Pause & Compact Log */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playUiTick();
                        setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
                      }}
                      aria-label={t.pauseAria}
                      className="h-8 w-8 pointer-events-auto flex items-center justify-center border-2 border-[#473d61] bg-[#161124]/92 hover:border-amber-400 text-[#f4efe6] transition-colors duration-150 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                    <div className="hidden xl:block bg-[#130f1f]/90 border border-[#473d61] px-2.5 py-0.5 text-center text-[11px] text-[#e8dff2] max-w-[240px] truncate">
                      {battleLog}
                    </div>
                  </div>

                  {/* Armored Wyvern Boss HP */}
                  <div
                    className={`bg-[#161124]/92 border-2 px-2.5 py-1.5 pixel-frame max-w-[245px] justify-self-end w-full ${
                      hud.dragonTransforming
                        ? 'border-amber-400'
                        : hud.lastDanceMode
                          ? 'border-amber-300 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                          : hud.dragonFurious
                            ? 'border-red-500'
                            : hud.dragonPhase2
                              ? 'border-[#ea580c]'
                              : 'border-[#473d61]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={`text-[10px] font-mono-num whitespace-nowrap ${
                          hud.dragonTransforming
                            ? 'text-amber-300 font-bold animate-pulse'
                            : hud.dragonStunned
                              ? 'text-amber-300 font-bold'
                              : hud.lastDanceMode
                                ? 'text-amber-300 font-bold animate-pulse'
                                : hud.dragonFurious
                                  ? 'text-red-400 font-bold animate-pulse'
                                  : hud.dragonPhase2
                                    ? 'text-orange-300 font-bold'
                                    : 'text-purple-300'
                        }`}
                      >
                        {hud.dragonTransforming
                          ? t.fakeoutTag
                          : hud.dragonStunned
                            ? t.stunnedTag
                            : hud.lastDanceMode
                              ? `${t.lastDanceTag} (${BATTLE_CONFIG.dragonLastDanceDmg})`
                              : hud.dragonFurious
                                ? t.furiousTag
                                : hud.dragonPhase2
                                  ? `${t.phase2Tag} (${BATTLE_CONFIG.dragonPhase2Dmg})`
                                  : `${t.dmgLabel}: ${BATTLE_CONFIG.dragonDmg}`}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-[#f4efe6] truncate">
                          {t.dragonName}
                        </span>
                        <DragonPixelIcon phase2={hud.dragonPhase2 || hud.dragonTransforming} />
                      </div>
                    </div>

                    <div className="mt-1 h-3 w-full bg-[#0c0914] border border-[#3a3152] p-0.5">
                      <div
                        className={`h-full transition-all duration-100 ml-auto ${
                          hud.dragonTransforming
                            ? 'bg-gradient-to-r from-amber-300 via-orange-500 to-red-500'
                            : hud.dragonStunned
                              ? 'bg-amber-400'
                              : hud.lastDanceMode
                                ? 'bg-gradient-to-r from-yellow-300 via-red-600 to-rose-700'
                                : hud.dragonFurious
                                  ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-300'
                                  : hud.dragonPhase2
                                    ? 'bg-[#ea580c]'
                                    : 'bg-[#7c3aed]'
                        }`}
                        style={{ width: `${dragonBarPct}%` }}
                      />
                    </div>

                    <div className="mt-0.5 flex items-center justify-between text-[11px] font-mono-num">
                      <span className="text-[#9e92b5]">/ {hud.dragonMaxHp}</span>
                      <span className="text-[#e5dcf0]">
                        {t.hpLabel}: {hud.dragonHp}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Direct-Control Pads */}
                <div
                  dir="ltr"
                  className="flex items-end justify-between gap-2 w-full pointer-events-auto"
                >
                  {/* Movement & Jump Pad */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Move Left"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.setMoveLeft(true);
                      }}
                      onPointerUp={() => engineRef.current?.setMoveLeft(false)}
                      onPointerLeave={() => engineRef.current?.setMoveLeft(false)}
                      onPointerCancel={() => engineRef.current?.setMoveLeft(false)}
                      className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center border-2 border-[#594b78] bg-[#161124]/88 active:bg-[#2d2345] text-[#f4efe6] pixel-frame cursor-pointer touch-none"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      aria-label="Jump"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerJump();
                      }}
                      onPointerUp={() => engineRef.current?.setJumpHeld(false)}
                      className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center border-2 border-[#594b78] bg-[#161124]/88 active:bg-[#2d2345] text-amber-200 pixel-frame cursor-pointer touch-none"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      aria-label="Move Right"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.setMoveRight(true);
                      }}
                      onPointerUp={() => engineRef.current?.setMoveRight(false)}
                      onPointerLeave={() => engineRef.current?.setMoveRight(false)}
                      onPointerCancel={() => engineRef.current?.setMoveRight(false)}
                      className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center border-2 border-[#594b78] bg-[#161124]/88 active:bg-[#2d2345] text-[#f4efe6] pixel-frame cursor-pointer touch-none"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Action Skills Pad */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerInteract();
                      }}
                      className={`h-10 sm:h-11 px-2.5 border-2 active:translate-y-0.5 text-[#f4efe6] font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap ${
                        hud.activeBuff
                          ? 'border-amber-300 bg-[#4c2810]/95'
                          : hud.activeSkillDrop
                            ? 'border-fuchsia-300 bg-[#3a164d]/95 hover:border-amber-300'
                            : 'border-[#5a4270] bg-[#1e162e]/90'
                      }`}
                    >
                      <span>
                        {hud.activeBuff
                          ? t.skillLabel[hud.activeBuff]
                          : hud.activeSkillDrop
                            ? t.skillLabel[hud.activeSkillDrop]
                            : t.skillTitle}
                      </span>
                      <span
                        className={`font-mono-num text-[9px] ${
                          hud.activeBuff
                            ? 'text-amber-300'
                            : hud.activeSkillDrop
                              ? 'text-fuchsia-200'
                              : 'text-purple-200'
                        }`}
                      >
                        {hud.activeBuff
                          ? `${hud.activeBuffTimer.toFixed(1)}s`
                          : hud.activeSkillDrop
                            ? t.skillActiveLabel
                            : t.skillInLabel(hud.nextSkillIn)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerInteract();
                      }}
                      className={`h-10 sm:h-11 px-2.5 border-2 active:translate-y-0.5 text-[#f4efe6] font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap ${
                        hud.activeDropWeapon
                          ? 'border-cyan-300 bg-[#153e4d]/95 hover:border-amber-300'
                          : 'border-[#6e7e99] bg-[#1e2436]/90'
                      }`}
                    >
                      <span>{t.weaponLabel[hud.weapon]}</span>
                      <span
                        className={`font-mono-num text-[9px] ${
                          hud.activeDropWeapon ? 'text-cyan-300' : 'text-slate-300'
                        }`}
                      >
                        {hud.activeDropWeapon ? t.dropActiveLabel : t.dropInLabel(hud.nextDropIn)}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={hud.dashCooldown > 0}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerDash();
                      }}
                      className="h-10 sm:h-11 px-2.5 border-2 border-sky-400/80 bg-[#183354]/90 hover:bg-[#214570] active:translate-y-0.5 disabled:opacity-50 text-sky-100 font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap"
                    >
                      <span>{t.dashBtn}</span>
                      <span className="font-mono-num text-[9px] text-sky-300">
                        {hud.dashCooldown > 0 ? `${hud.dashCooldown.toFixed(1)}s` : 'SHIFT'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={hud.parryCooldown > 0}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerParry();
                      }}
                      className="h-10 sm:h-11 px-2.5 border-2 border-amber-400/85 bg-[#4a3515]/90 hover:bg-[#66491d] active:translate-y-0.5 disabled:opacity-50 text-amber-100 font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {t.parryBtn}
                      </span>
                      <span className="font-mono-num text-[9px] text-amber-200">
                        {hud.parryCooldown > 0 ? `${hud.parryCooldown.toFixed(1)}s` : 'Q / R-CLK'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={hud.healCooldown > 0 || hud.healCharges <= 0}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerHeal();
                      }}
                      className="h-10 sm:h-11 px-2.5 border-2 border-[#6ee7b7] bg-[#167a56]/92 hover:bg-[#1b9167] active:translate-y-0.5 disabled:opacity-45 disabled:border-[#4b5563] disabled:bg-[#1f2937]/80 text-white font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap"
                    >
                      <span>{t.healBtn} (+{BATTLE_CONFIG.warriorHeal})</span>
                      <span className="font-mono-num text-[9px] text-emerald-100">
                        {hud.healCharges <= 0
                          ? t.noHealsLeft
                          : hud.healCooldown > 0
                            ? `${hud.healCooldown.toFixed(1)}s`
                            : `${hud.healCharges}/${hud.maxHealCharges} · H`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerAttack();
                      }}
                      className="h-10 sm:h-11 px-3 border-2 border-[#f59e0b] bg-[#b82d2d]/95 hover:bg-[#d13b3b] active:translate-y-0.5 text-white font-bold text-xs flex flex-col items-center justify-center pixel-frame cursor-pointer touch-none whitespace-nowrap"
                    >
                      <span>
                        {t.attackBtn} {hud.comboStep > 0 ? `${hud.comboStep}/3` : ''}
                      </span>
                      <span className="font-mono-num text-[9px] text-amber-200">J / CLICK</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PAUSE MODAL */}
            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#09070f]/80 p-4">
                <div className="w-full max-w-xs bg-[#181326] border-2 border-[#5c4f7d] p-5 pixel-frame text-center">
                  <h2 className="font-pixel text-lg text-amber-300">{t.pausedTitle}</h2>

                  <div className="mt-5 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playUiTick();
                        setGameState('PLAYING');
                      }}
                      className="h-10 px-4 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      <span>{t.resumeBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={startNewBattle}
                      className="h-10 px-4 border-2 border-[#473d61] bg-[#241c38] hover:border-amber-400 text-[#f4efe6] font-bold text-sm flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t.restartBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={returnToTitle}
                      className="h-10 px-4 border-2 border-[#362e4a] bg-[#141020] hover:border-[#6a5c8c] text-[#c9bedc] font-bold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      {t.titleMenuBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VICTORY / GAME OVER MODAL */}
            {gameState === 'GAME_OVER' && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#09070f]/84 p-4">
                <div className="w-full max-w-sm bg-[#181326] border-2 border-[#6a5a91] p-5 pixel-frame text-center">
                  <div className="flex justify-center mb-2">
                    {summary.winner === 'warrior' ? (
                      <WarriorPixelIcon />
                    ) : (
                      <DragonPixelIcon phase2={hud.dragonPhase2} />
                    )}
                  </div>

                  <h2
                    className={`font-pixel text-lg sm:text-xl font-bold ${
                      summary.winner === 'warrior' ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {summary.winner === 'warrior' ? t.warriorWins : t.dragonWins}
                  </h2>

                  {activeSession && (
                    <p className="mt-1 text-[11px] font-mono-num text-[#cbbfe0]">
                      {activeSession.playerName} ·{' '}
                      {activeSession.mode === 'online' ? t.recordedOnlineTag : t.recordedLocalTag}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#110d1b] border border-[#3a3152] px-2.5 py-1.5">
                      <div className="text-[#9e92b5]">{t.timeStat}</div>
                      <div className="font-mono-num text-base font-bold text-[#f4efe6]">
                        {formatDurationMs(summary.durationMs || summary.durationSec * 1000)}
                      </div>
                    </div>
                    <div className="bg-[#110d1b] border border-[#3a3152] px-2.5 py-1.5">
                      <div className="text-[#9e92b5]">{t.dealtStat}</div>
                      <div className="font-mono-num text-base font-bold text-amber-300">
                        {summary.damageDealt}
                      </div>
                    </div>
                    <div className="bg-[#110d1b] border border-[#3a3152] px-2.5 py-1.5">
                      <div className="text-[#9e92b5]">{t.critsStat}</div>
                      <div className="font-mono-num text-base font-bold text-yellow-300">
                        {summary.critsLanded}
                      </div>
                    </div>
                    <div className="bg-[#110d1b] border border-[#3a3152] px-2.5 py-1.5">
                      <div className="text-[#9e92b5]">{t.parriesStat}</div>
                      <div className="font-mono-num text-base font-bold text-sky-300">
                        {summary.parriesLanded}
                      </div>
                    </div>
                  </div>

                  {activeSession?.mode === 'local' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRegError(null);
                        setRegModalOpen(true);
                      }}
                      className="mt-3 w-full h-9 px-3 border border-amber-400/70 bg-[#2a1d18] hover:bg-[#38251e] text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-amber-300" />
                      <span>{t.syncResultOnlineBtn}</span>
                    </button>
                  )}

                  <div className="mt-4 flex flex-col sm:flex-row gap-2.5 justify-center">
                    <button
                      type="button"
                      onClick={startNewBattle}
                      className="h-11 px-6 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] text-white font-bold text-sm flex items-center justify-center gap-2 pixel-frame transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t.playAgain}</span>
                    </button>

                    <button
                      type="button"
                      onClick={returnToTitle}
                      className="h-11 px-4 border-2 border-[#473d61] bg-[#241c38] hover:border-amber-400 text-[#f4efe6] font-bold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      {t.titleMenuBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Live Leaderboard & Battle Feed OR C++ Source Panel */}
        {!expandedGame && (
          <div
            className={`min-h-[380px] lg:min-h-0 h-full ${
              swapSides ? 'lg:order-1' : 'lg:order-2'
            }`}
          >
            {sidePanel === 'leaderboard' ? (
              <LeaderboardPortal
                lang={lang}
                activeSession={activeSession}
                players={displayedPlayers}
                recentMatches={displayedMatches}
                loading={boardLoading}
                syncError={syncError}
                isSubmittingMatch={isSubmittingMatch}
                onOpenRegistration={() => {
                  setRegError(null);
                  setRegModalOpen(true);
                }}
                onUpgradeToOnline={() => {
                  setRegError(null);
                  setRegModalOpen(true);
                }}
              />
            ) : (
              <CppCodePanel lang={lang} lastEvent={hud.lastEvent} winner={activeWinner} />
            )}
          </div>
        )}
      </main>

      {/* Player Registration / Callsign Gate Modal */}
      <PlayerRegistrationModal
        open={regModalOpen}
        lang={lang}
        initialName={activeSession?.playerName || ''}
        isGoogleSignedIn={Boolean(firebaseUser)}
        currentUid={firebaseUser?.uid || null}
        existingPlayers={onlinePlayers}
        canDismiss={Boolean(activeSession)}
        isSubmitting={isRegistering}
        submitError={regError}
        onSubmitOnline={handleOnlineRegister}
        onSubmitLocal={handleLocalRegister}
        onClose={() => setRegModalOpen(false)}
      />
    </div>
  );
}
