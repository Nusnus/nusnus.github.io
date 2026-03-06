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
    <div className="flex items-center gap-0.5 rounded-md border border-green-500/20 bg-green-500/5 px-1 py-0.5">
      {LANG_ORDER.map((lang) => {
        const config = LANGUAGES[lang];
        const isActive = lang === language;
        return (
          <button
            key={lang}
            onClick={() => onChange(lang)}
            className={`rounded px-1.5 py-0.5 text-xs transition-all ${
              isActive
                ? 'bg-green-500/20 text-green-400'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
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
