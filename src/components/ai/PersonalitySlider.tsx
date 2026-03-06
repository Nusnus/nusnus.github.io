import { useState, useEffect } from 'react';
import { cn } from '@lib/utils/cn';

/** Personality levels for the Grok Spectrum slider */
const PERSONALITY_LEVELS = [
  { id: 0, label: 'Professional', description: 'Formal and business-like' },
  { id: 1, label: 'Casual', description: 'Friendly and approachable' },
  { id: 2, label: 'Witty', description: 'Clever and humorous' },
  { id: 3, label: 'Sarcastic', description: 'Sharp and ironic' },
  { id: 4, label: 'Grok Mode', description: 'Unfiltered and edgy' },
] as const;

const STORAGE_KEY = 'nusnus:personality-level';

interface PersonalitySliderProps {
  onChange?: (level: number) => void;
}

/** Grok Spectrum personality slider — controls AI humor/vulgarity level */
export function PersonalitySlider({ onChange }: PersonalitySliderProps) {
  const [level, setLevel] = useState(2); // Default to "Witty"
  const [isDragging, setIsDragging] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 0 && parsed < PERSONALITY_LEVELS.length) {
          setLevel(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save preference and notify parent
  const updateLevel = (newLevel: number) => {
    setLevel(newLevel);
    try {
      localStorage.setItem(STORAGE_KEY, newLevel.toString());
    } catch {
      // Ignore localStorage errors
    }
    onChange?.(newLevel);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateLevel(parseInt(e.target.value, 10));
  };

  const currentPersonality = PERSONALITY_LEVELS[level];

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-text-primary mb-1 text-sm font-semibold">Grok Spectrum</h3>
        <p className="text-text-secondary text-xs">
          {currentPersonality.label} — {currentPersonality.description}
        </p>
      </div>

      {/* Slider container */}
      <div className="relative px-2 py-6">
        {/* Track with gradient */}
        <div className="bg-border absolute top-1/2 right-2 left-2 h-1 -translate-y-1/2 rounded-full">
          <div
            className="bg-accent absolute top-0 left-0 h-full rounded-full transition-all duration-300"
            style={{ width: `${(level / (PERSONALITY_LEVELS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Level markers */}
        <div className="relative flex justify-between">
          {PERSONALITY_LEVELS.map((p) => (
            <button
              key={p.id}
              onClick={() => updateLevel(p.id)}
              className={cn(
                'group relative flex min-h-[44px] min-w-[44px] touch-manipulation flex-col items-center justify-center rounded-lg transition-all duration-200 active:scale-95',
                'focus-visible:ring-accent focus-visible:ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              )}
              aria-label={`Set personality to ${p.label}`}
            >
              {/* Marker dot */}
              <div
                className={cn(
                  'border-bg-base relative z-10 h-5 w-5 rounded-full border-2 transition-all duration-300',
                  level === p.id
                    ? 'bg-accent shadow-accent/50 scale-125 shadow-lg'
                    : 'bg-bg-surface group-hover:bg-bg-elevated group-hover:scale-110',
                )}
              >
                {/* Pulse animation for active level */}
                {level === p.id && (
                  <span className="bg-accent absolute inset-0 animate-ping rounded-full opacity-75" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-3 text-xs font-medium transition-all duration-200',
                  level === p.id
                    ? 'text-accent'
                    : 'text-text-muted group-hover:text-text-secondary',
                )}
              >
                {p.label}
              </span>
            </button>
          ))}
        </div>

        {/* Hidden range input for accessibility and touch support */}
        <input
          type="range"
          min="0"
          max={PERSONALITY_LEVELS.length - 1}
          step="1"
          value={level}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="absolute inset-0 z-20 h-full w-full cursor-pointer touch-manipulation opacity-0"
          style={{ touchAction: 'pan-y' }}
          aria-label="Personality level slider"
          aria-valuetext={currentPersonality.label}
        />
      </div>

      {/* Visual feedback during drag */}
      {isDragging && (
        <div className="bg-accent/10 border-accent/30 mt-2 rounded-lg border px-3 py-2 text-center">
          <p className="text-accent text-xs font-medium">{currentPersonality.label}</p>
        </div>
      )}
    </div>
  );
}

/** Get the current personality level from localStorage */
export function getPersonalityLevel(): number {
  if (typeof window === 'undefined') return 2; // Default to "Witty" on server
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 0 && parsed < PERSONALITY_LEVELS.length) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return 2; // Default to "Witty"
}
