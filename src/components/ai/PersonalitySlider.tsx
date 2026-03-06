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
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-medium tracking-wider text-gray-500 uppercase">Tone</span>
      <div className="flex items-center gap-0.5">
        {LEVELS.map((l) => {
          const lConfig = PERSONALITY_LEVELS[l];
          const isActive = l === level;
          return (
            <button
              key={l}
              onClick={() => onChange(l)}
              className={`h-1.5 w-4 rounded-full transition-all duration-200 ${
                isActive
                  ? `${lConfig.bgColorClass} shadow-sm`
                  : l <= level
                    ? 'bg-cyan-500/20'
                    : 'bg-white/[0.06] hover:bg-white/10'
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
