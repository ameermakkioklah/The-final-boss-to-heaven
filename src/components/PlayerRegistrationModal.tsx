import { useEffect, useState, type FormEvent } from 'react';
import { Check, Globe, Shield, Sword, UserCheck, X } from 'lucide-react';
import { BLUEPRINT_CONSTRAINTS } from '../firebase';
import type { Language } from '../game/types';
import {
  sanitizePlayerName,
  validatePlayerName,
  type PlayerProfileRecord,
} from '../services/leaderboard';

interface PlayerRegistrationModalProps {
  open: boolean;
  lang: Language;
  initialName: string;
  isGoogleSignedIn: boolean;
  currentUid: string | null;
  existingPlayers: PlayerProfileRecord[];
  canDismiss: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmitOnline: (cleanedName: string) => Promise<void>;
  onSubmitLocal: (cleanedName: string) => void;
  onClose: () => void;
}

const MODAL_COPY = {
  ar: {
    title: 'سجّل اسم المحارب للدخول للساحة',
    editTitle: 'تعديل اسم المحارب أو ربط الحساب',
    subtitle: 'يتم تتبع انتصاراتك وهزائمك وعدد قتلات التنين وأسرع وقت فوز لك في الترتيب المباشر.',
    label: 'اسم المحارب (2–20 حرفاً)',
    placeholder: 'مثال: ShadowKnight أو فارس_الظلام',
    onlineBtnSignedIn: 'حفظ الاسم في الترتيب العالمي',
    onlineBtnSignIn: 'دخول بحساب Google والتسجيل عالمياً',
    localBtn: 'لعب محلي سريع (هذه الجلسة فقط)',
    saving: 'جارٍ الحفظ...',
    closeAria: 'إغلاق',
    useSuggestion: (s: string) => `جرّب: ${s}`,
    trackedHint: 'الإحصائيات المسجلة: قتلات التنين · أسرع وقت · حالة الفوز/الهزيمة',
  },
  en: {
    title: 'Register Your Warrior Callsign',
    editTitle: 'Update Warrior Callsign & Rank Sync',
    subtitle: 'Your Dragon kills, fastest clear time, and every Victory or Defeat are tracked live.',
    label: 'Player Name (2–20 chars)',
    placeholder: 'e.g. ShadowKnight',
    onlineBtnSignedIn: 'Save to Live Global Leaderboard',
    onlineBtnSignIn: 'Sign in with Google & Join Live Leaderboard',
    localBtn: 'Play Local Session Only',
    saving: 'Registering...',
    closeAria: 'Close',
    useSuggestion: (s: string) => `Try: ${s}`,
    trackedHint: 'Tracked stats: Dragon Kills · Best Clear Time · Victory / Defeat Status',
  },
};

export function PlayerRegistrationModal({
  open,
  lang,
  initialName,
  isGoogleSignedIn,
  currentUid,
  existingPlayers,
  canDismiss,
  isSubmitting,
  submitError,
  onSubmitOnline,
  onSubmitLocal,
  onClose,
}: PlayerRegistrationModalProps) {
  const [nameInput, setNameInput] = useState(initialName);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setNameInput(initialName);
      setTouched(false);
    }
  }, [open, initialName]);

  if (!open) return null;

  const t = MODAL_COPY[lang];
  const validation = validatePlayerName(nameInput, existingPlayers, currentUid);
  const cleanedLength = sanitizePlayerName(nameInput).length;
  const validationMessage = touched
    ? lang === 'ar'
      ? validation.errorAr
      : validation.errorEn
    : undefined;

  const handleOnlineSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validation.valid || isSubmitting) return;
    await onSubmitOnline(validation.cleaned);
  };

  const handleLocalClick = () => {
    setTouched(true);
    if (!validation.valid || isSubmitting) return;
    onSubmitLocal(validation.cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07050c]/88 p-4"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-reg-title"
        className="relative w-full max-w-md bg-[#161124] border-2 border-[#5c4f7d] p-5 sm:p-6 pixel-frame text-[#f4efe6]"
      >
        {canDismiss && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeAria}
            className="absolute top-3 end-3 h-8 w-8 flex items-center justify-center border border-[#473d61] bg-[#1e1730] hover:border-amber-400 text-[#cbbfe0] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 flex items-center justify-center border-2 border-amber-400/80 bg-[#281b18] text-amber-300 shrink-0">
            <Sword className="w-4 h-4" />
          </div>
          <h2 id="player-reg-title" className="font-pixel text-base sm:text-lg text-amber-300 leading-snug">
            {canDismiss ? t.editTitle : t.title}
          </h2>
        </div>

        <p className="mt-2.5 text-xs text-[#cbbfe0] leading-relaxed">{t.subtitle}</p>

        <form onSubmit={handleOnlineSubmit} className="mt-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="warrior-name-input" className="font-bold text-[#e8e0f5]">
                {t.label}
              </label>
              <span className="font-mono-num text-[11px] text-[#9e92b5]">
                {cleanedLength}/{BLUEPRINT_CONSTRAINTS.playerNameMaxLength}
              </span>
            </div>

            <input
              id="warrior-name-input"
              type="text"
              autoFocus
              maxLength={BLUEPRINT_CONSTRAINTS.playerNameMaxLength + 4}
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (!touched) setTouched(true);
              }}
              placeholder={t.placeholder}
              className="w-full h-11 px-3 bg-[#0c0914] border-2 border-[#473d61] focus:border-amber-400 outline-none text-sm text-[#f4efe6] placeholder:text-[#6b5f85] font-mono-num"
            />

            {validationMessage && (
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-rose-400">
                <span>{validationMessage}</span>
                {validation.suggestion && (
                  <button
                    type="button"
                    onClick={() => setNameInput(validation.suggestion || '')}
                    className="px-2 py-0.5 border border-amber-400/70 bg-[#251c38] text-amber-300 hover:bg-[#32254a] text-[11px] font-mono-num cursor-pointer shrink-0"
                  >
                    {t.useSuggestion(validation.suggestion)}
                  </button>
                )}
              </div>
            )}

            {submitError && (
              <p className="mt-1.5 text-xs text-rose-400 break-words leading-relaxed">{submitError}</p>
            )}
          </div>

          <div className="pt-1 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={!validation.valid || isSubmitting}
              className="h-11 px-4 border-2 border-amber-300 bg-[#d9483b] hover:bg-[#eb594b] disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 pixel-frame transition-colors duration-150 cursor-pointer"
            >
              {isGoogleSignedIn ? <Check className="w-4 h-4 shrink-0" /> : <Globe className="w-4 h-4 shrink-0" />}
              <span>{isSubmitting ? t.saving : isGoogleSignedIn ? t.onlineBtnSignedIn : t.onlineBtnSignIn}</span>
            </button>

            {!isGoogleSignedIn && (
              <button
                type="button"
                disabled={!validation.valid || isSubmitting}
                onClick={handleLocalClick}
                className="h-10 px-4 border-2 border-[#473d61] bg-[#211a33] hover:border-amber-400 disabled:opacity-45 disabled:cursor-not-allowed text-[#e8e0f5] font-bold text-xs flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>{t.localBtn}</span>
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-[#2c2440] flex items-center gap-2 text-[11px] text-[#9e92b5]">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{t.trackedHint}</span>
        </div>
      </div>
    </div>
  );
}
