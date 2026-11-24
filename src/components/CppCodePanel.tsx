import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CombatEvent, Language, Winner } from '../game/types';

export const CLEAN_CPP_CODE = `#include <iostream>
#include <string>
using namespace std;

class Character {
public:
    string name;
    int hp;
    int dmg;

    Character(string n, int h, int d) {
        name = n;
        hp = h;
        dmg = d;
    }

    void attack(Character& enemy) {
        enemy.hp -= dmg;
        if (enemy.hp < 0) enemy.hp = 0;
        cout << name << " attacks " << enemy.name
             << "! (" << enemy.name << " HP: " << enemy.hp << ")\\n";
    }

    void heal(int amount) {
        hp += amount;
        cout << name << " heals +" << amount
             << "! (HP: " << hp << ")\\n";
    }
};

int main() {
    Character warrior("Warrior", 250, 20);
    Character dragon("Dragon", 400, 24);
    int healCharges = 5;

    int turn = 1;

    while (warrior.hp > 0 && dragon.hp > 0) {
        cout << "\\n========== Turn " << turn << " ==========\\n";
        cout << warrior.name << " HP: " << warrior.hp
             << " | " << dragon.name << " HP: " << dragon.hp << "\\n";

        int choice;
        cout << "1. Attack Dragon\\n";
        cout << "2. Heal (+45 HP, " << healCharges << " left)\\n";
        cout << "Your move: ";
        cin >> choice;

        if (choice == 1) {
            warrior.attack(dragon);
        } else if (choice == 2 && healCharges > 0) {
            warrior.heal(45);
            healCharges--;
        } else {
            cout << "Invalid choice or no heals left!\\n";
        }

        if (dragon.hp > 0) {
            dragon.attack(warrior);
        }

        turn++;
    }

    cout << "\\n========== Result ==========\\n";
    if (warrior.hp > 0) {
        cout << "Warrior Wins!\\n";
    } else {
        cout << "Dragon Wins!\\n";
    }

    return 0;
}`;

const KEYWORDS = new Set([
  'include',
  'using',
  'namespace',
  'class',
  'public',
  'void',
  'int',
  'if',
  'else',
  'while',
  'return',
]);

const TYPES_AND_STD = new Set(['iostream', 'string', 'std', 'cout', 'cin', 'Character']);

function tokenizeCppLine(line: string): { text: string; className: string }[] {
  const tokens: { text: string; className: string }[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Preprocessor directive
    if (ch === '#') {
      tokens.push({ text: line.slice(i), className: 'text-rose-400' });
      break;
    }

    // String literal
    if (ch === '"') {
      let end = i + 1;
      while (end < line.length) {
        if (line[end] === '\\' && end + 1 < line.length) {
          end += 2;
        } else if (line[end] === '"') {
          end += 1;
          break;
        } else {
          end += 1;
        }
      }
      tokens.push({ text: line.slice(i, end), className: 'text-emerald-300' });
      i = end;
      continue;
    }

    // Angle bracket header <iostream>
    if (ch === '<' && line.trimStart().startsWith('#include')) {
      const close = line.indexOf('>', i);
      if (close !== -1) {
        tokens.push({ text: line.slice(i, close + 1), className: 'text-emerald-300' });
        i = close + 1;
        continue;
      }
    }

    // Identifiers / keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i + 1;
      while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) {
        end += 1;
      }
      const word = line.slice(i, end);
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, className: 'text-amber-300 font-semibold' });
      } else if (TYPES_AND_STD.has(word)) {
        tokens.push({ text: word, className: 'text-sky-300' });
      } else {
        tokens.push({ text: word, className: 'text-[#e8e0f5]' });
      }
      i = end;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let end = i + 1;
      while (end < line.length && /[0-9]/.test(line[end])) {
        end += 1;
      }
      tokens.push({ text: line.slice(i, end), className: 'text-orange-300' });
      i = end;
      continue;
    }

    // Punctuation / whitespace
    tokens.push({ text: ch, className: 'text-[#a89cc0]' });
    i += 1;
  }

  return tokens;
}

function getHighlightedLines(lastEvent: CombatEvent, winner: Winner): Set<number> {
  if (winner === 'warrior') return new Set([70, 71]);
  if (winner === 'dragon') return new Set([72, 73]);

  switch (lastEvent.type) {
    case 'warrior_attack':
      return new Set([21, 22, 23, 24, 25, 53, 54]);
    case 'warrior_parry':
      return new Set([21, 22, 53, 54]);
    case 'warrior_heal':
      return new Set([28, 29, 30, 31, 55, 56, 57]);
    case 'dragon_attack':
    case 'dragon_fakeout':
    case 'dragon_phase2':
    case 'dragon_furious':
    case 'last_dance':
      return new Set([62, 63, 64]);
    case 'warrior_awakening':
      return new Set([35, 36]);
    case 'weapon_swap':
      return new Set([36, 37]);
    case 'super_skill':
      return new Set([21, 22, 23, 53, 54]);
    default:
      return new Set([35, 36, 37, 38]);
  }
}

interface CppCodePanelProps {
  lang: Language;
  lastEvent: CombatEvent;
  winner: Winner;
}

export function CppCodePanel({ lang, lastEvent, winner }: CppCodePanelProps) {
  const [copied, setCopied] = useState(false);

  const lines = CLEAN_CPP_CODE.split('\n');
  const activeLines = getHighlightedLines(lastEvent, winner);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CLEAN_CPP_CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-label={lang === 'ar' ? 'كود سي بلس بلس' : 'C++ Source Code'}
      className="flex flex-col h-full min-h-0 bg-[#13101d] border border-[#352c4a] rounded-lg overflow-hidden"
    >
      {/* Code Panel Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[#2b233d] bg-[#181425] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono-num text-xs sm:text-sm font-semibold text-[#f4efe6] truncate">
            main.cpp
          </span>
          <span className="text-xs text-[#9e92b5] whitespace-nowrap">
            {lang === 'ar' ? 'C++ · كود اللعبة الأساسي' : 'C++ · Core Combat Logic'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="h-8 px-3 border border-[#473d61] bg-[#211b33] hover:border-amber-400 text-xs font-medium text-[#f4efe6] rounded flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'ar' ? 'تم النسخ' : 'Copied'}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#c6badb]" />
              <span>{lang === 'ar' ? 'نسخ الكود' : 'Copy C++'}</span>
            </>
          )}
        </button>
      </div>

      {/* Scrollable Clean C++ Code */}
      <div
        dir="ltr"
        className="flex-1 min-h-0 overflow-auto py-3 px-2 sm:px-3 font-mono-num text-[12px] sm:text-[13px] leading-6"
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => {
              const lineNo = index + 1;
              const isHighlighted = activeLines.has(lineNo);
              const tokens = tokenizeCppLine(line);
              return (
                <tr
                  key={lineNo}
                  className={
                    isHighlighted
                      ? 'bg-amber-400/12 transition-colors duration-200'
                      : 'hover:bg-white/[0.02]'
                  }
                >
                  <td className="w-9 pr-3 text-right select-none text-[11px] text-[#6d6185] align-top">
                    {lineNo}
                  </td>
                  <td className="pr-4 whitespace-pre align-top">
                    {tokens.length === 0 ? (
                      ' '
                    ) : (
                      tokens.map((tok, tIdx) => (
                        <span key={tIdx} className={tok.className}>
                          {tok.text}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
