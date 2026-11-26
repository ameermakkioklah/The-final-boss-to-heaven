import { useEffect, useState, type FormEvent } from 'react';
import { Check, Globe, LogIn, LogOut, Shield, Sword, UserCheck, X } from 'lucide-react';
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
  googleEmail: string | null;
  existingPlayers: PlayerProfileRecord[];
  canDismiss: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  infoNotice: string | null;
  onGoogleSignInRestore: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onSubmitOnline: (cleanedName: string) => Promise<void>;
  onSubmitLocal: (cleanedName: string) => void;
  onClose: () => void;
}

const MODAL_COPY = {
  ar: {
    title: 'الدخول إلى ساحة التنين',
    editTitle: 'إعدادات اسم المحارب والحساب',
    subtitle: 'إذا كان لديك حساب مرتبط بـ Google مسبقاً يمكنك استرجاعه بضغطة واحدة، أو سجّل اسماً جديداً للبدء.',
    restoreSectionTitle: 'لديك حساب مسبق؟ استرجع تقدمك فوراً',
    restoreBtn: 'تسجيل الدخول بحساب Google (استرجاع الحساب)',
    restoring: 'جارٍ تسجيل الدخول...',
    orDivider: 'أو سجّل اسماً جديداً',
    signedInAs: (email: string) => `متصل بحساب: ${email}`,
    switchAccountBtn: 'تغيير الحساب / خروج',
    label: 'اسم المحارب (2–20 حرفاً)',
    placeholder: 'مثال: ShadowKnight أو فارس_الظلام',
    onlineBtnSignedIn: 'حفظ الاسم في الترتيب العالمي',
    onlineBtnSignIn: 'إنشاء حساب جديد عبر Google وحفظ الاسم',
    localBtn: 'لعب محلي سريع (هذه الجلسة فقط)',
    saving: 'جارٍ الحفظ...',
    closeAria: 'إغلاق',
    useSuggestion: (s: string) => `جرّب: ${s}`,
    trackedHint: 'الإحصائيات المسجلة: قتلات التنين · أسرع وقت · حالة الفوز/الهزيمة',
  },
  en: {
    title: 'Enter the Dragon Arena',
    editTitle: 'Warrior Callsign & Account Sync',
    subtitle: 'Already linked with Google? Restore your saved Warrior instantly, or register a new callsign below.',
    restoreSectionTitle: 'Returning Player? Restore Saved Profile',
    restoreBtn: 'Sign in with Google (Restore Account)',
    restoring: 'Signing in...',
    orDivider: 'or register a new callsign',
    signedInAs: (email: string) => `Signed in: ${email}`,
    switchAccountBtn: 'Sign Out / Switch',
    label: 'Player Name (2–20 chars)',
    placeholder: 'e.g. ShadowKnight',
    onlineBtnSignedIn: 'Save Callsign to Global Leaderboard',
    onlineBtnSignIn: 'Sign in with Google & Save New Callsign',
    localBtn: 'Play Local Session Only',
    saving: 'Saving...',
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
  googleEmail,
  existingPlayers,
  canDismiss,
  isSubmitting,
  submitError,
  infoNotice,
  onGoogleSignInRestore,
  onGoogleSignOut,
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
        className="relative w-full max-w-md bg-[#161124] border-2 border-[#5c4f7d] p-5 sm:p-6 pixel-frame text-[#f4efe6] max-h-[92vh] overflow-y-auto"
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

        <div className="flex items-center gap-2.5 pe-8">
          <div className="h-9 w-9 flex items-center justify-center border-2 border-amber-400/80 bg-[#281b18] text-amber-300 shrink-0">
            <Sword className="w-4 h-4" />
          </div>
          <h2 id="player-reg-title" className="font-pixel text-base sm:text-lg text-amber-300 leading-snug">
            {canDismiss ? t.editTitle : t.title}
          </h2>
        </div>

        <p className="mt-2.5 text-xs text-[#cbbfe0] leading-relaxed">{t.subtitle}</p>

        {/* Direct 1-Click Returning Google Account Restore OR Active Google Account Banner */}
        {!isGoogleSignedIn ? (
          <div className="mt-4 p-3 border border-sky-400/40 bg-[#11192b]">
            <div className="text-[11px] font-bold text-sky-200 mb-2">
              {t.restoreSectionTitle}
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void onGoogleSignInRestore()}
              className="w-full h-10 px-3 border-2 border-sky-400 bg-[#1a3a63] hover:bg-[#234d82] disabled:opacity-45 text-white font-bold text-xs flex items-center justify-center gap-2 pixel-frame transition-colors duration-150 cursor-pointer"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>{isSubmitting ? t.restoring : t.restoreBtn}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 px-3 py-2 border border-emerald-500/40 bg-emerald-950/30 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-200 font-mono-num truncate">
              {t.signedInAs(googleEmail || 'Google')}
            </span>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void onGoogleSignOut()}
              className="px-2 py-1 border border-[#473d61] bg-[#1e1730] hover:border-rose-400 text-[#e8e0f5] text-[10px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>{t.switchAccountBtn}</span>
            </button>
          </div>
        )}

        {infoNotice && (
          <div className="mt-3 px-3 py-2 border border-amber-400/50 bg-amber-950/35 text-xs text-amber-200 leading-relaxed">
            {infoNotice}
          </div>
        )}

        {!isGoogleSignedIn && (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8e82a8]">
            <div className="flex-1 h-px bg-[#2e2645]" />
            <span>{t.orDivider}</span>
            <div className="flex-1 h-px bg-[#2e2645]" />
          </div>
        )}

        <form onSubmit={handleOnlineSubmit} className="mt-3.5 space-y-3.5">
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
              autoFocus={isGoogleSignedIn}
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
