import { useState } from 'react';
import {
  Clock,
  Crown,
  Flame,
  Globe,
  Pencil,
  Skull,
  Swords,
  Trophy,
  UserCheck,
} from 'lucide-react';
import type { Language } from '../game/types';
import {
  formatDurationMs,
  formatRelativeTime,
  type ActivePlayerSession,
  type MatchRunRecord,
  type PlayerProfileRecord,
} from '../services/leaderboard';

interface LeaderboardPortalProps {
  lang: Language;
  activeSession: ActivePlayerSession | null;
  players: PlayerProfileRecord[];
  recentMatches: MatchRunRecord[];
  loading: boolean;
  syncError: string | null;
  isSubmittingMatch: boolean;
  onOpenRegistration: () => void;
  onUpgradeToOnline: () => void;
}

const PORTAL_COPY = {
  ar: {
    boardTitle: 'ترتيب صيادي التنين المباشر',
    liveTag: 'مباشر',
    tabRankings: 'المتصدرون',
    tabFeed: 'سجل المعارك',
    activeWarrior: 'المحارب النشط',
    onlineMode: 'مرتبط عالمياً',
    localMode: 'جلسة محلية',
    changeName: 'تغيير / ربط',
    syncOnlineBtn: 'اربط بحساب Google للنشر عالمياً',
    registerPrompt: 'سجّل اسمك لتظهر نتائجك هنا',
    registerNow: 'تسجيل الاسم',
    colRank: '#',
    colPlayer: 'اللاعب',
    colKills: 'القتلات',
    colBestTime: 'أسرع وقت',
    colStatus: 'آخر معركة',
    youTag: 'أنت',
    localTag: 'محلي',
    victory: 'انتصار',
    defeat: 'هزيمة',
    ready: 'مستعد',
    noKillsTime: '--',
    emptyPlayers: 'لا يوجد محاربون مسجلون بعد. ادخل الساحة وسجّل أول انتصار أو مواجهة!',
    emptyFeed: 'ابدأ معركة التنين وستظهر نتائج الفوز والخسارة هنا فور انتهائها.',
    savingRun: 'جارٍ تحديث النتيجة المباشرة...',
    statMatches: 'المباريات',
    statKills: 'قتل التنين',
    statBest: 'أسرع فوز',
    dragonSlainBy: 'صرع التنين!',
    fellToDragon: 'سقط أمام التنين',
  },
  en: {
    boardTitle: 'Live Dragon Slayer Board',
    liveTag: 'LIVE',
    tabRankings: 'Leaderboard',
    tabFeed: 'Live Matches',
    activeWarrior: 'Active Warrior',
    onlineMode: 'Global Sync',
    localMode: 'Local Session',
    changeName: 'Edit / Sync',
    syncOnlineBtn: 'Sign in with Google to Sync Globally',
    registerPrompt: 'Register a player name to track your runs',
    registerNow: 'Register Name',
    colRank: '#',
    colPlayer: 'Player',
    colKills: 'Kills',
    colBestTime: 'Best Time',
    colStatus: 'Last Match',
    youTag: 'YOU',
    localTag: 'LOCAL',
    victory: 'Victory',
    defeat: 'Defeat',
    ready: 'Ready',
    noKillsTime: '--',
    emptyPlayers: 'No warriors ranked yet. Enter the arena to claim the first Dragon kill!',
    emptyFeed: 'Finish a Dragon boss battle — every Victory and Defeat updates here live.',
    savingRun: 'Syncing match outcome...',
    statMatches: 'Matches',
    statKills: 'Dragon Kills',
    statBest: 'Best Time',
    dragonSlainBy: 'Slew the Dragon!',
    fellToDragon: 'Fell to the Dragon',
  },
};

export function LeaderboardPortal({
  lang,
  activeSession,
  players,
  recentMatches,
  loading,
  syncError,
  isSubmittingMatch,
  onOpenRegistration,
  onUpgradeToOnline,
}: LeaderboardPortalProps) {
  const [activeTab, setActiveTab] = useState<'rankings' | 'feed'>('rankings');
  const t = PORTAL_COPY[lang];

  const myProfile = activeSession
    ? players.find((p) => p.uid === activeSession.playerId) || null
    : null;

  return (
    <aside
      aria-label={t.boardTitle}
      className="h-full min-h-0 flex flex-col border-2 border-[#3a3152] bg-[#120e1c] pixel-frame overflow-hidden"
    >
      {/* Portal Top Header */}
      <div className="px-3.5 py-2.5 border-b border-[#2d2542] bg-[#181326] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="font-pixel text-xs sm:text-sm text-amber-300 truncate">{t.boardTitle}</h2>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-emerald-500/50 bg-emerald-950/50 text-[10px] font-mono-num font-bold text-emerald-300 shrink-0">
          <span className="w-1.5 h-1.5 bg-emerald-400" />
          {t.liveTag}
        </span>
      </div>

      {/* Active Player Card */}
      <div className="px-3.5 py-2.5 border-b border-[#2a223b] bg-[#141020] shrink-0">
        {activeSession ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[#9e92b5]">
                  {t.activeWarrior}
                </div>
                <div className="mt-0.5 flex items-center gap-2 min-w-0">
                  <span className="font-pixel text-sm text-[#f4efe6] truncate">
                    {activeSession.playerName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono-num shrink-0 ${
                      activeSession.mode === 'online'
                        ? 'border-sky-400/50 bg-sky-950/40 text-sky-300'
                        : 'border-amber-400/40 bg-amber-950/30 text-amber-200'
                    }`}
                  >
                    {activeSession.mode === 'online' ? (
                      <Globe className="w-2.5 h-2.5" />
                    ) : (
                      <UserCheck className="w-2.5 h-2.5" />
                    )}
                    <span>{activeSession.mode === 'online' ? t.onlineMode : t.localMode}</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenRegistration}
                className="h-8 px-2.5 border border-[#473d61] bg-[#1e1730] hover:border-amber-400 text-[11px] font-bold text-[#e8e0f5] inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Pencil className="w-3 h-3" />
                <span>{t.changeName}</span>
              </button>
            </div>

            {/* Personal Quick Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-[#0e0b16] border border-[#2f2645] px-2 py-1.5">
                <div className="text-[10px] text-[#9e92b5]">{t.statKills}</div>
                <div className="font-mono-num text-sm font-bold text-amber-300 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                  <span>{myProfile?.dragonKills ?? 0}</span>
                </div>
              </div>
              <div className="bg-[#0e0b16] border border-[#2f2645] px-2 py-1.5">
                <div className="text-[10px] text-[#9e92b5]">{t.statBest}</div>
                <div className="font-mono-num text-sm font-bold text-emerald-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{formatDurationMs(myProfile?.bestTimeMs ?? null)}</span>
                </div>
              </div>
              <div className="bg-[#0e0b16] border border-[#2f2645] px-2 py-1.5">
                <div className="text-[10px] text-[#9e92b5]">{t.statMatches}</div>
                <div className="font-mono-num text-sm font-bold text-[#f4efe6]">
                  {myProfile?.matchesPlayed ?? 0}
                </div>
              </div>
            </div>

            {activeSession.mode === 'local' && (
              <button
                type="button"
                onClick={onUpgradeToOnline}
                className="w-full h-8 px-3 border border-amber-400/70 bg-[#2a1d18] hover:bg-[#38251e] text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{t.syncOnlineBtn}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#cbbfe0]">{t.registerPrompt}</span>
            <button
              type="button"
              onClick={onOpenRegistration}
              className="h-8 px-3 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] text-white font-bold text-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              {t.registerNow}
            </button>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 border-b border-[#2d2542] bg-[#161224] shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('rankings')}
          className={`h-9 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'rankings'
              ? 'border-amber-400 bg-[#1f1933] text-amber-300'
              : 'border-transparent text-[#9e92b5] hover:text-[#e8e0f5]'
          }`}
        >
          <Crown className="w-3.5 h-3.5 shrink-0" />
          <span>{t.tabRankings}</span>
          <span className="font-mono-num text-[10px] opacity-80">({players.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`h-9 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'feed'
              ? 'border-amber-400 bg-[#1f1933] text-amber-300'
              : 'border-transparent text-[#9e92b5] hover:text-[#e8e0f5]'
          }`}
        >
          <Swords className="w-3.5 h-3.5 shrink-0" />
          <span>{t.tabFeed}</span>
          <span className="font-mono-num text-[10px] opacity-80">({recentMatches.length})</span>
        </button>
      </div>

      {/* Status Notices */}
      {(isSubmittingMatch || syncError) && (
        <div
          className={`px-3.5 py-1.5 border-b border-[#2a223b] text-[11px] font-mono-num shrink-0 ${
            syncError ? 'bg-rose-950/50 text-rose-300' : 'bg-amber-950/40 text-amber-200'
          }`}
        >
          {syncError || t.savingRun}
        </div>
      )}

      {/* Scrollable Data Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="h-10 bg-[#1a1529] border border-[#2a223b] animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'rankings' ? (
          players.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#9e92b5] leading-relaxed">
              {t.emptyPlayers}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#161124] border-b border-[#32294a] text-[10px] uppercase tracking-wider text-[#9e92b5]">
                <tr>
                  <th className="py-2 px-2.5 text-start w-9">{t.colRank}</th>
                  <th className="py-2 px-2 text-start">{t.colPlayer}</th>
                  <th className="py-2 px-2 text-end">{t.colKills}</th>
                  <th className="py-2 px-2 text-end">{t.colBestTime}</th>
                  <th className="py-2 px-2.5 text-end">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#221b33]">
                {players.map((player, idx) => {
                  const isMe = activeSession?.playerId === player.uid;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={player.uid}
                      className={
                        isMe
                          ? 'bg-[#221b36] text-[#f4efe6]'
                          : 'hover:bg-[#181326] text-[#e5dcf0]'
                      }
                    >
                      <td className="py-2.5 px-2.5 font-mono-num font-bold">
                        {rank === 1 ? (
                          <span className="text-amber-300">1</span>
                        ) : rank === 2 ? (
                          <span className="text-slate-200">2</span>
                        ) : rank === 3 ? (
                          <span className="text-orange-300">3</span>
                        ) : (
                          <span className="text-[#8e82a8]">{rank}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold truncate max-w-[120px] sm:max-w-[150px]">
                            {player.playerName}
                          </span>
                          {isMe && (
                            <span className="px-1 py-0.2 border border-amber-400/60 bg-amber-950/50 text-[9px] font-mono-num text-amber-300 shrink-0">
                              {t.youTag}
                            </span>
                          )}
                          {player.isLocal && (
                            <span className="px-1 py-0.2 border border-sky-400/40 bg-sky-950/40 text-[9px] font-mono-num text-sky-300 shrink-0">
                              {t.localTag}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono-num text-[#8e82a8]">
                          {player.wins}W · {player.losses}L
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-end font-mono-num font-bold text-amber-300">
                        {player.dragonKills}
                      </td>

                      <td className="py-2.5 px-2 text-end font-mono-num font-bold text-emerald-300">
                        {player.dragonKills > 0
                          ? formatDurationMs(player.bestTimeMs)
                          : t.noKillsTime}
                      </td>

                      <td className="py-2.5 px-2.5 text-end whitespace-nowrap">
                        {player.lastOutcome === 'win' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                            <Crown className="w-3 h-3 shrink-0" />
                            <span>{t.victory}</span>
                          </span>
                        ) : player.lastOutcome === 'loss' ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                            <Skull className="w-3 h-3 shrink-0" />
                            <span>{t.defeat}</span>
                          </span>
                        ) : (
                          <span className="text-[#8e82a8]">{t.ready}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : recentMatches.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#9e92b5] leading-relaxed">{t.emptyFeed}</div>
        ) : (
          <ul className="divide-y divide-[#221b33]">
            {recentMatches.map((run) => {
              const isWin = run.outcome === 'win';
              const isMe = activeSession?.playerId === run.uid;
              return (
                <li
                  key={run.id}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                    isMe ? 'bg-[#1e1830]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`h-7 w-7 flex items-center justify-center border shrink-0 ${
                        isWin
                          ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                          : 'border-rose-500/60 bg-rose-950/50 text-rose-400'
                      }`}
                    >
                      {isWin ? <Crown className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-[#f4efe6] truncate">
                          {run.playerName}
                        </span>
                        {run.isLocal && (
                          <span className="px-1 border border-sky-400/40 text-[9px] font-mono-num text-sky-300 shrink-0">
                            {t.localTag}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] flex items-center gap-1.5">
                        <span className={isWin ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                          {isWin ? t.victory : t.defeat}
                        </span>
                        <span className="text-[#6d618a]">·</span>
                        <span className="text-[#a599bd]">
                          {isWin ? t.dragonSlainBy : t.fellToDragon}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <div className="font-mono-num text-xs font-bold text-[#f4efe6]">
                      {formatDurationMs(run.durationMs)}
                    </div>
                    <div className="text-[10px] font-mono-num text-[#8e82a8]">
                      {formatRelativeTime(run.createdAtMs, lang)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
