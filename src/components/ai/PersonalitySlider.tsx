/**
 * PersonalitySlider — "Grok Spectrum" 6-level personality control.
 * Compact slider integrated into the chat header.
 */
import { PERSONALITY_LEVELS } from '@lib/ai/config';
import type { PersonalityLevel } from '@lib/ai/config';

interface PersonalitySliderProps {
  level: PersonalityLevel;
  onChange: (level: PersonalityLevel) => void;
}

const LEVELS: PersonalityLevel[] = [0, 1, 2, 3, 4, 5];

export function PersonalitySlider({ level, onChange }: PersonalitySliderProps) {
  const config = PERSONALITY_LEVELS[level];

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="text-text-muted text-[10px] font-medium tracking-wider uppercase">Tone</span>
      <div className="flex items-center gap-0.5">
        {LEVELS.map((l) => {
          const lConfig = PERSONALITY_LEVELS[l];
          const isActive = l === level;
          return (
            <button
              key={l}
              onClick={() => onChange(l)}
              className={`h-1.5 w-5 rounded-full transition-all duration-200 ${
                isActive
                  ? `${lConfig.colorClass.replace('text-', 'bg-')} shadow-sm`
                  : l <= level
                    ? 'bg-green-500/30'
                    : 'bg-white/10 hover:bg-white/20'
              }`}
              title={`${lConfig.label}: ${lConfig.description}`}
              aria-label={`Set personality to ${lConfig.label}`}
            />
          );
        })}
      </div>
      <span className={`text-[10px] font-semibold ${config.colorClass}`}>{config.label}</span>
    </div>
  );
}
