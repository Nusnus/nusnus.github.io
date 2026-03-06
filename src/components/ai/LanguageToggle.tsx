/**
 * LanguageToggle — compact flag-based language selector.
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
    <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-1 py-0.5">
      {LANG_ORDER.map((lang) => {
        const config = LANGUAGES[lang];
        const isActive = lang === language;
        return (
          <button
            key={lang}
            onClick={() => onChange(lang)}
            className={`rounded-md px-1.5 py-0.5 text-xs transition-all ${
              isActive
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-gray-500 hover:bg-white/[0.06] hover:text-gray-300'
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
