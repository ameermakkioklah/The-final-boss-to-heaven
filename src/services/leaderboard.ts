import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { BLUEPRINT_CONSTRAINTS, OperationType, db, handleFirestoreError } from '../firebase';
import type { BattleSummary, Language } from '../game/types';

export type MatchOutcome = 'win' | 'loss';
export type LastOutcome = 'none' | MatchOutcome;

export interface PlayerProfileRecord {
  uid: string;
  playerName: string;
  playerNameLower: string;
  dragonKills: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  bestTimeMs: number | null;
  lastOutcome: LastOutcome;
  lastDurationMs: number;
  createdAtMs: number;
  updatedAtMs: number;
  isLocal?: boolean;
}

export interface MatchRunRecord {
  id: string;
  uid: string;
  playerName: string;
  outcome: MatchOutcome;
  dragonKilled: boolean;
  durationMs: number;
  damageDealt: number;
  critsLanded: number;
  parriesLanded: number;
  createdAtMs: number;
  isLocal?: boolean;
}

export interface ActivePlayerSession {
  playerId: string;
  playerName: string;
  mode: 'online' | 'local';
}

const SESSION_STORAGE_KEY = 'tfbth_active_player_v1';
const LOCAL_PROFILE_KEY = 'tfbth_local_profile_v1';
const LOCAL_MATCHES_KEY = 'tfbth_local_matches_v1';

// Concise profanity list (EN + transliterated/AR stems) checked safely against normalized tokens
const PROFANITY_TERMS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cunt',
  'whore',
  'slut',
  'nigger',
  'faggot',
  'retard',
  'كس',
  'شرموط',
  'قحب',
  'منيوك',
  'نيك',
  'عرص',
  'زبي',
];

export function sanitizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export interface NameValidationResult {
  valid: boolean;
  cleaned: string;
  errorAr?: string;
  errorEn?: string;
  suggestion?: string;
}

export function validatePlayerName(
  raw: string,
  existingPlayers: PlayerProfileRecord[],
  currentUid?: string | null,
): NameValidationResult {
  const cleaned = sanitizePlayerName(raw);

  if (!cleaned) {
    return {
      valid: false,
      cleaned,
      errorAr: 'يرجى إدخال اسم اللاعب للمتابعة.',
      errorEn: 'Please enter a player name to continue.',
    };
  }

  if (cleaned.length < BLUEPRINT_CONSTRAINTS.playerNameMinLength) {
    return {
      valid: false,
      cleaned,
      errorAr: `يجب أن لا يقل الاسم عن ${BLUEPRINT_CONSTRAINTS.playerNameMinLength} أحرف.`,
      errorEn: `Name must be at least ${BLUEPRINT_CONSTRAINTS.playerNameMinLength} characters.`,
    };
  }

  if (cleaned.length > BLUEPRINT_CONSTRAINTS.playerNameMaxLength) {
    return {
      valid: false,
      cleaned,
      errorAr: `الحد الأقصى لاسم اللاعب هو ${BLUEPRINT_CONSTRAINTS.playerNameMaxLength} حرفاً.`,
      errorEn: `Name cannot exceed ${BLUEPRINT_CONSTRAINTS.playerNameMaxLength} characters.`,
    };
  }

  if (!BLUEPRINT_CONSTRAINTS.playerNamePattern.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      errorAr: 'يحتوي الاسم على رموز غير مسموح بها.',
      errorEn: 'Name contains disallowed symbols (< > & " \' / \\ { } [ ]).',
    };
  }

  const lower = cleaned.toLowerCase();
  const compact = lower.replace(/[\s_\-]+/g, '');
  if (PROFANITY_TERMS.some((term) => lower.includes(term) || compact.includes(term))) {
    return {
      valid: false,
      cleaned,
      errorAr: 'يرجى اختيار اسم لائق ومناسب للساحة.',
      errorEn: 'Please choose an appropriate warrior name.',
    };
  }

  const duplicate = existingPlayers.find(
    (p) => !p.isLocal && p.playerNameLower === lower && p.uid !== currentUid,
  );
  if (duplicate) {
    const suffix = Math.floor(10 + Math.random() * 89);
    const base = cleaned.slice(0, Math.max(2, BLUEPRINT_CONSTRAINTS.playerNameMaxLength - 3));
    return {
      valid: false,
      cleaned,
      errorAr: 'هذا الاسم مستخدم بالفعل من قِبل لاعب آخر.',
      errorEn: 'This player name is already claimed by another warrior.',
      suggestion: `${base}_${suffix}`,
    };
  }

  return { valid: true, cleaned };
}

export function generateLocalPlayerId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `local_${Date.now().toString(36)}_${rand}`;
}

export function loadActiveSession(): ActivePlayerSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActivePlayerSession>;
    if (
      typeof parsed.playerId === 'string' &&
      typeof parsed.playerName === 'string' &&
      (parsed.mode === 'online' || parsed.mode === 'local')
    ) {
      return {
        playerId: parsed.playerId,
        playerName: sanitizePlayerName(parsed.playerName),
        mode: parsed.mode,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActivePlayerSession | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadLocalProfile(): PlayerProfileRecord | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerProfileRecord;
    if (typeof parsed?.uid !== 'string' || typeof parsed?.playerName !== 'string') return null;
    return { ...parsed, isLocal: true };
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: PlayerProfileRecord | null): void {
  try {
    if (!profile) {
      window.localStorage.removeItem(LOCAL_PROFILE_KEY);
      return;
    }
    window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify({ ...profile, isLocal: true }));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadLocalMatches(): MatchRunRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_MATCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MatchRunRecord[];
    return Array.isArray(parsed) ? parsed.map((m) => ({ ...m, isLocal: true })) : [];
  } catch {
    return [];
  }
}

export function saveLocalMatches(matches: MatchRunRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(matches.slice(0, 15)));
  } catch {
    // Ignore storage quota issues
  }
}

export function recordLocalMatchOutcome(
  session: ActivePlayerSession,
  summary: BattleSummary,
): { profile: PlayerProfileRecord; matches: MatchRunRecord[] } {
  const now = Date.now();
  const won = summary.winner === 'warrior';
  const durationMs = Math.max(
    BLUEPRINT_CONSTRAINTS.minDurationMs,
    Math.min(BLUEPRINT_CONSTRAINTS.maxDurationMs, Math.round(summary.durationMs || summary.durationSec * 1000)),
  );
  const existing = loadLocalProfile();
  const base: PlayerProfileRecord =
    existing && existing.uid === session.playerId
      ? existing
      : {
          uid: session.playerId,
          playerName: session.playerName,
          playerNameLower: session.playerName.toLowerCase(),
          dragonKills: 0,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          bestTimeMs: null,
          lastOutcome: 'none',
          lastDurationMs: 0,
          createdAtMs: now,
          updatedAtMs: now,
          isLocal: true,
        };

  const nextBest = won
    ? base.bestTimeMs === null
      ? durationMs
      : Math.min(base.bestTimeMs, durationMs)
    : base.bestTimeMs;

  const updatedProfile: PlayerProfileRecord = {
    ...base,
    playerName: session.playerName,
    playerNameLower: session.playerName.toLowerCase(),
    dragonKills: base.dragonKills + (won ? 1 : 0),
    wins: base.wins + (won ? 1 : 0),
    losses: base.losses + (won ? 0 : 1),
    matchesPlayed: base.matchesPlayed + 1,
    bestTimeMs: nextBest,
    lastOutcome: won ? 'win' : 'loss',
    lastDurationMs: durationMs,
    updatedAtMs: now,
    isLocal: true,
  };
  saveLocalProfile(updatedProfile);

  const nextMatch: MatchRunRecord = {
    id: `local_run_${now}`,
    uid: session.playerId,
    playerName: session.playerName,
    outcome: won ? 'win' : 'loss',
    dragonKilled: won,
    durationMs,
    damageDealt: Math.max(0, Math.round(summary.damageDealt)),
    critsLanded: Math.max(0, Math.round(summary.critsLanded)),
    parriesLanded: Math.max(0, Math.round(summary.parriesLanded)),
    createdAtMs: now,
    isLocal: true,
  };
  const updatedMatches = [nextMatch, ...loadLocalMatches()].slice(0, 15);
  saveLocalMatches(updatedMatches);

  return { profile: updatedProfile, matches: updatedMatches };
}

function tsToMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

export function sortLeaderboardPlayers(players: PlayerProfileRecord[]): PlayerProfileRecord[] {
  return [...players].sort((a, b) => {
    if (b.dragonKills !== a.dragonKills) return b.dragonKills - a.dragonKills;
    if (a.dragonKills > 0 && b.dragonKills > 0) {
      const aBest = a.bestTimeMs ?? Number.MAX_SAFE_INTEGER;
      const bBest = b.bestTimeMs ?? Number.MAX_SAFE_INTEGER;
      if (aBest !== bBest) return aBest - bBest;
    }
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return b.updatedAtMs - a.updatedAtMs;
  });
}

export function subscribeLeaderboard(
  onData: (players: PlayerProfileRecord[]) => void,
  onError: (err: Error) => void,
): () => void {
  const path = 'players';
  const q = query(collection(db, path), orderBy('dragonKills', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const records: PlayerProfileRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          playerName: String(data.playerName || 'Warrior'),
          playerNameLower: String(data.playerNameLower || String(data.playerName || '').toLowerCase()),
          dragonKills: Number(data.dragonKills || 0),
          matchesPlayed: Number(data.matchesPlayed || 0),
          wins: Number(data.wins || 0),
          losses: Number(data.losses || 0),
          bestTimeMs: typeof data.bestTimeMs === 'number' ? data.bestTimeMs : null,
          lastOutcome:
            data.lastOutcome === 'win' || data.lastOutcome === 'loss' ? data.lastOutcome : 'none',
          lastDurationMs: Number(data.lastDurationMs || 0),
          createdAtMs: tsToMs(data.createdAt),
          updatedAtMs: tsToMs(data.updatedAt),
        };
      });
      onData(sortLeaderboardPlayers(records));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeRecentMatches(
  onData: (matches: MatchRunRecord[]) => void,
  onError: (err: Error) => void,
): () => void {
  const path = 'matches';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(25));
  return onSnapshot(
    q,
    (snapshot) => {
      const runs: MatchRunRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid || ''),
          playerName: String(data.playerName || 'Warrior'),
          outcome: data.outcome === 'win' ? 'win' : 'loss',
          dragonKilled: Boolean(data.dragonKilled),
          durationMs: Number(data.durationMs || 1000),
          damageDealt: Number(data.damageDealt || 0),
          critsLanded: Number(data.critsLanded || 0),
          parriesLanded: Number(data.parriesLanded || 0),
          createdAtMs: tsToMs(data.createdAt),
        };
      });
      onData(runs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function registerOrUpdateOnlinePlayer(
  uid: string,
  rawName: string,
  existingPlayers: PlayerProfileRecord[],
): Promise<string> {
  const check = validatePlayerName(rawName, existingPlayers, uid);
  if (!check.valid) {
    throw new Error(check.errorEn || 'Invalid player name');
  }

  const cleaned = check.cleaned;
  const lower = cleaned.toLowerCase();
  const path = `players/${uid}`;
  const playerRef = doc(db, 'players', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(playerRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(playerRef, {
        uid,
        playerName: cleaned,
        playerNameLower: lower,
        dragonKills: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        bestTimeMs: null,
        lastOutcome: 'none',
        lastDurationMs: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(playerRef, {
        playerName: cleaned,
        playerNameLower: lower,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return cleaned;
}

export async function recordOnlineMatchOutcome(params: {
  uid: string;
  playerName: string;
  summary: BattleSummary;
}): Promise<void> {
  const { uid, summary } = params;
  const cleanedName = sanitizePlayerName(params.playerName).slice(
    0,
    BLUEPRINT_CONSTRAINTS.playerNameMaxLength,
  );
  const safeName =
    cleanedName.length >= BLUEPRINT_CONSTRAINTS.playerNameMinLength &&
    BLUEPRINT_CONSTRAINTS.playerNamePattern.test(cleanedName)
      ? cleanedName
      : 'Warrior';
  const safeNameLower = safeName.toLowerCase();

  const playerPath = `players/${uid}`;
  const playerRef = doc(db, 'players', uid);

  let playerSnap;
  try {
    playerSnap = await getDoc(playerRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, playerPath);
  }

  // Ensure profile exists before atomic match + profile batch so get()/getAfter() rules pass cleanly
  if (!playerSnap.exists()) {
    try {
      await setDoc(playerRef, {
        uid,
        playerName: safeName,
        playerNameLower: safeNameLower,
        dragonKills: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        bestTimeMs: null,
        lastOutcome: 'none',
        lastDurationMs: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      playerSnap = await getDoc(playerRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, playerPath);
    }
  }

  const currentData = playerSnap.data() || {};
  const prevKills = Number(currentData.dragonKills || 0);
  const prevWins = Number(currentData.wins || 0);
  const prevLosses = Number(currentData.losses || 0);
  const prevMatches = Number(currentData.matchesPlayed || 0);
  const prevBest = typeof currentData.bestTimeMs === 'number' ? currentData.bestTimeMs : null;

  const won = summary.winner === 'warrior';
  const durationMs = Math.max(
    BLUEPRINT_CONSTRAINTS.minDurationMs,
    Math.min(
      BLUEPRINT_CONSTRAINTS.maxDurationMs,
      Math.round(summary.durationMs || summary.durationSec * 1000),
    ),
  );

  const matchRef = doc(collection(db, 'matches'));
  const batch = writeBatch(db);

  if (won) {
    const nextBest = prevBest === null ? durationMs : Math.min(prevBest, durationMs);
    batch.update(playerRef, {
      playerName: safeName,
      playerNameLower: safeNameLower,
      dragonKills: prevKills + 1,
      wins: prevWins + 1,
      matchesPlayed: prevMatches + 1,
      bestTimeMs: nextBest,
      lastOutcome: 'win',
      lastDurationMs: durationMs,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(playerRef, {
      playerName: safeName,
      playerNameLower: safeNameLower,
      losses: prevLosses + 1,
      matchesPlayed: prevMatches + 1,
      lastOutcome: 'loss',
      lastDurationMs: durationMs,
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(matchRef, {
    uid,
    playerName: safeName,
    outcome: won ? 'win' : 'loss',
    dragonKilled: won,
    durationMs,
    damageDealt: Math.max(0, Math.min(BLUEPRINT_CONSTRAINTS.maxCounter, Math.round(summary.damageDealt))),
    critsLanded: Math.max(0, Math.min(BLUEPRINT_CONSTRAINTS.maxEventsPerRun, Math.round(summary.critsLanded))),
    parriesLanded: Math.max(0, Math.min(BLUEPRINT_CONSTRAINTS.maxEventsPerRun, Math.round(summary.parriesLanded))),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${playerPath} + matches/${matchRef.id}`);
  }
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return '--';
  const totalSec = ms / 1000;
  if (totalSec >= 60) {
    const mins = Math.floor(totalSec / 60);
    const remSec = totalSec - mins * 60;
    const secStr = remSec < 10 ? `0${remSec.toFixed(1)}` : remSec.toFixed(1);
    return `${mins}:${secStr}`;
  }
  return `${totalSec.toFixed(1)}s`;
}

export function formatRelativeTime(timestampMs: number, lang: Language): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 15) return lang === 'ar' ? 'الآن' : 'Just now';
  if (diffSec < 60) return lang === 'ar' ? `منذ ${diffSec}ث` : `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === 'ar' ? `منذ ${diffMin}د` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === 'ar' ? `منذ ${diffHr}س` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return lang === 'ar' ? `منذ ${diffDay}ي` : `${diffDay}d ago`;
}
