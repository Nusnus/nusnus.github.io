/**
 * PersonalitySlider — "Grok Spectrum" 6-level personality control.
 * Matrix-inspired compact slider.
 */
import { PERSONALITY_LEVELS } from '@lib/ai/config';
import type { PersonalityLevel } from '@lib/ai/config';

interface PersonalitySliderProps {
  level: PersonalityLevel;
  onChange: (level: PersonalityLevel) => void;
}

const LEVELS: PersonalityLevel[] = [0, 1, 2, 3, 4, 5];

export function PersonalitySlider({ level, onChange }: PersonalitySliderProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {LEVELS.map((l) => {
          const lConfig = PERSONALITY_LEVELS[l];
          const isActive = l === level;
          return (
            <button
              key={l}
              onClick={() => onChange(l)}
              className={`h-2 w-5 rounded-sm transition-all duration-200 ${
                isActive
                  ? `${lConfig.bgColorClass} shadow-sm`
                  : l <= level
                    ? 'bg-emerald-500/25'
                    : 'bg-emerald-500/[0.08] hover:bg-emerald-500/15'
              }`}
              title={`${lConfig.label}: ${lConfig.description}`}
              aria-label={`Set personality to ${lConfig.label}`}
            />
          );
        })}
      </div>
    </div>
  );
}
