/**
 * LanguageToggle — compact flag-based language selector.
 * Matrix-inspired styling.
 */
import { LANGUAGES } from '@lib/ai/config';
import type { Language } from '@lib/ai/config';

interface LanguageToggleProps {
  language: Language;
  onChange: (lang: Language) => void;
}

const LANG_ORDER: Language[] = ['en', 'es', 'he'];

export function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-emerald-500/10 bg-emerald-500/[0.03] px-1 py-0.5">
      {LANG_ORDER.map((lang) => {
        const config = LANGUAGES[lang];
        const isActive = lang === language;
        return (
          <button
            key={lang}
            onClick={() => onChange(lang)}
            className={`rounded px-1.5 py-0.5 text-xs transition-all ${
              isActive
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-emerald-800 hover:bg-emerald-500/[0.08] hover:text-emerald-500'
            }`}
            title={config.label}
            aria-label={`Switch to ${config.label}`}
          >
            {config.flag}
          </button>
        );
      })}
    </div>
  );
}
