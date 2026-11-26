import { useEffect, useState } from 'react';
import { FastForward } from 'lucide-react';
import type { DialogueCue } from '../game/cutscene';

interface DialogueBoxProps {
  cue: DialogueCue | null;
  cutsceneLocked: boolean;
  onSkipCutscene?: () => void;
}

export function DialogueBox({ cue, cutsceneLocked, onSkipCutscene }: DialogueBoxProps) {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    if (!cue) {
      setVisibleChars(0);
      return;
    }

    if (cue.isBanter) {
      setVisibleChars(cue.text.length);
      return;
    }

    setVisibleChars(0);
    let idx = 0;
    let timerId: number | null = null;
    let cancelled = false;

    const fallbackStepMs =
      cue.delivery === 'stammer' ? 52 : cue.delivery === 'tremble' ? 66 : cue.delivery === 'booming' ? 28 : 34;

    const targetRevealMs = cue.audioDurationSec
      ? Math.max(400, cue.audioDurationSec * 1000 * 0.82)
      : cue.text.length * fallbackStepMs;
    const baseStepMs = Math.max(18, Math.min(95, targetRevealMs / Math.max(1, cue.text.length)));

    const advance = () => {
      if (cancelled) return;
      idx += 1;
      setVisibleChars(idx);
      if (idx >= cue.text.length) return;

      const ch = cue.text[idx - 1];
      let delay = baseStepMs;
      if (ch === '.' && (cue.delivery === 'stammer' || cue.delivery === 'tremble')) {
        delay = Math.max(baseStepMs, 110);
      } else if (ch === '-' && cue.delivery === 'stammer') {
        delay = Math.max(baseStepMs, 130);
      } else if (ch === ',' || ch === '—') {
        delay = Math.max(baseStepMs, 95);
      }
      timerId = window.setTimeout(advance, delay);
    };

    timerId = window.setTimeout(advance, 16);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [cue]);

  if (!cue && !cutsceneLocked) return null;

  // Compact upper banter banner during live combat (zero HUD obstruction)
  if (cue?.isBanter) {
    return (
      <div
        dir="ltr"
        className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 w-full max-w-md"
      >
        <div className="bg-[#140d1f]/90 border border-purple-400/70 px-3 py-1.5 pixel-frame text-center shadow-[0_4px_14px_rgba(0,0,0,0.65)]">
          <div className="text-[9px] font-pixel uppercase tracking-widest text-purple-300">
            {cue.speakerName}
          </div>
          <p className="mt-0.5 text-xs font-mono-num text-[#f4efe6] leading-snug">
            &ldquo;{cue.text}&rdquo;
          </p>
        </div>
      </div>
    );
  }

  const isDragon = cue?.speaker === 'dragon';
  const isTrembling = cue?.delivery === 'stammer' || cue?.delivery === 'tremble';
  const displayedText = cue ? cue.text.slice(0, visibleChars) : '';

  return (
    <div dir="ltr" className="absolute inset-0 z-25 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Skip Control during Cutscenes */}
      <div className="flex justify-end">
        {cutsceneLocked && onSkipCutscene && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSkipCutscene();
            }}
            className="pointer-events-auto h-8 px-2.5 border border-[#594b78] bg-[#161124]/92 hover:border-amber-400 text-[11px] font-mono-num font-bold text-[#e8e0f5] inline-flex items-center gap-1.5 pixel-frame cursor-pointer"
          >
            <span>Skip</span>
            <FastForward className="w-3 h-3 text-amber-300" />
          </button>
        )}
      </div>

      {/* Bottom Cinematic RPG Subtitle Frame */}
      {cue && (
        <div className="w-full max-w-xl mx-auto mb-1 sm:mb-3 bg-[#100c1a]/94 border-2 border-[#594b78] px-4 py-3 pixel-frame">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`font-pixel text-[11px] uppercase tracking-wider ${
                isDragon ? 'text-rose-400' : 'text-amber-300'
              }`}
            >
              {cue.speakerName}
            </span>
            {isTrembling && (
              <span className="text-[10px] font-mono-num text-rose-300/80 italic">
                strained
              </span>
            )}
          </div>

          <p
            className={`text-xs sm:text-sm font-mono-num text-[#f4efe6] leading-relaxed min-h-[2.25rem] ${
              isTrembling ? 'animate-pulse' : ''
            }`}
          >
            &ldquo;{displayedText}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
