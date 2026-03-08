/**
 * ThoughtsPanel — Matrix-style floating AI thoughts about Tomer.
 *
 * Displays a stream of witty, data-driven observations that fall like
 * Matrix digital rain on the right side of the chat page. Each thought
 * fades in at the top, drifts down, and fades out at the bottom.
 * Only visible on wide screens (xl+).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/** A single thought bubble with position and animation state. */
interface FloatingThought {
  id: number;
  text: string;
  /** Horizontal position as percentage (0-100) */
  x: number;
  /** Animation duration in seconds */
  duration: number;
  /** Animation delay in seconds */
  delay: number;
  /** Font size class */
  size: 'sm' | 'xs' | 'base';
  /** Opacity multiplier */
  opacity: number;
}

/**
 * Curated thoughts — witty observations about Tomer's professional life.
 * These are based on the data in persona.md and knowledge.md.
 */
const THOUGHTS: string[] = [
  // Celery & open source
  'celery.apply_async(roast_tomer, countdown=0)',
  '28K+ stars... still counting',
  '#3 all-time contributor to Celery',
  'CEO & Tech Lead, Celery Organization',
  'git log --author="Nusnus" | wc -l  // too many',
  'pytest-celery: built from scratch',
  'RabbitMQ, Redis, SQS... he speaks broker',
  '10+ repos under one roof',
  'kombu: messaging done right',
  'billiard > multiprocessing // his words',
  '"I see myself as an artist and my art comes in the form of code"',
  'The Matrix has him... writing task queues',
  'Celery v5.5.0 release manager',

  // Technical skills
  'Python at the CPython level',
  'Distributed systems architect',
  'E2E thinking: inception to deployment',
  'Docker containers for breakfast',
  'CI/CD pipeline whisperer',
  'TypeScript + React + Astro 5',
  'async def life(): await celery.run()',

  // Work ethic & personality
  '2,400+ contributions last year',
  'Commits at 2 AM on a Monday',
  '"The 4th commit is always a refactor"',
  'Herzliya, IL -> The Matrix',
  'Hebrew, English, Spanish: trilingual dev',
  'Point-First Approach: lead with the conclusion',
  'Mamram graduate // IDF elite programming',
  'The man who cannot say no to a PR',

  // Meta & witty
  'Loading professional universe...',
  'Scanning GitHub contribution graph...',
  'Analyzing commit patterns... impressive',
  'Cross-referencing repo dependencies...',
  'Indexing 28,000+ stargazers...',
  'Processing open source karma...',
  'Nusnus: a handle that needs no explanation',
  'Building the simulation from inside',
  '"What is real?" - Morpheus, 1999',
  'Neo dodges bullets; Tomer dodges merge conflicts',
  'The Oracle of distributed task queues',
  'import celery; import life  # same thing',
  'Achievement unlocked: mass adoption',
  'Blacksmith CI partnership: speed matters',
  'Cognition AI recognized his contributions',
  'nusnus.github.io > linkedin // upgrade',
  'Running inference on career trajectory...',
  'Stack overflow: not the error, the knowledge',
  'Open source is not a hobby, it is a calling',
  'Powered by xAI Grok // naturally',
];

/** Shuffle array using Fisher-Yates (no non-null assertions). */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

const SIZES: FloatingThought['size'][] = ['xs', 'sm', 'base'];

/** Build a single floating thought object. */
function buildThought(id: number, text: string, delaySeconds: number): FloatingThought {
  return {
    id,
    text,
    x: 5 + Math.random() * 80,
    duration: 18 + Math.random() * 14,
    delay: delaySeconds,
    size: SIZES[Math.floor(Math.random() * SIZES.length)] ?? 'sm',
    opacity: 0.08 + Math.random() * 0.2,
  };
}

const INITIAL_COUNT = 8;

/** Generate the initial batch of thoughts staggered in time. */
function createInitialThoughts(): FloatingThought[] {
  const pool = shuffle(THOUGHTS);
  const out: FloatingThought[] = [];
  for (let i = 0; i < INITIAL_COUNT; i++) {
    const text = pool[i] ?? THOUGHTS[0] ?? '';
    out.push(buildThought(i, text, i * 2.5));
  }
  return out;
}

export function ThoughtsPanel() {
  const [thoughts, setThoughts] = useState<FloatingThought[]>(createInitialThoughts);
  const nextIdRef = useRef(INITIAL_COUNT);
  const shuffledRef = useRef<string[]>(shuffle(THOUGHTS));
  const indexRef = useRef(INITIAL_COUNT);

  /** Pick next thought text (cycles through shuffled pool). */
  const nextThought = useCallback((): string => {
    if (indexRef.current >= shuffledRef.current.length) {
      shuffledRef.current = shuffle(THOUGHTS);
      indexRef.current = 0;
    }
    const text = shuffledRef.current[indexRef.current] ?? '';
    indexRef.current++;
    return text;
  }, []);

  useEffect(() => {
    // Add new thoughts periodically
    const interval = setInterval(() => {
      const id = nextIdRef.current++;
      const text = nextThought();
      const thought = buildThought(id, text, 0);

      setThoughts((prev) => {
        const active = prev.length < 12 ? prev : prev.slice(1);
        return [...active, thought];
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [nextThought]);

  return (
    <div className="relative hidden h-full w-[280px] shrink-0 overflow-hidden xl:block">
      {/* Gradient overlays blend panel edges seamlessly into the chat background */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-bg-base), color-mix(in oklch, var(--color-bg-base) 30%, transparent), var(--color-bg-base))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{
          background: 'linear-gradient(to right, var(--color-bg-base), transparent)',
        }}
      />

      {/* Header — subtle, blends into background */}
      <div className="relative z-20 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="bg-accent/20 absolute inline-flex h-full w-full animate-ping rounded-full" />
            <span className="bg-accent/30 relative inline-flex h-1.5 w-1.5 rounded-full" />
          </span>
          <span className="text-accent/20 font-mono text-[10px] tracking-widest uppercase">
            Neural Stream
          </span>
        </div>
      </div>

      {/* Floating thoughts container */}
      <div className="absolute inset-0 pt-10">
        {thoughts.map((thought) => (
          <div
            key={thought.id}
            className="thought-float absolute px-3"
            style={
              {
                left: `${thought.x}%`,
                transform: 'translateX(-50%)',
                '--float-duration': `${thought.duration}s`,
                '--float-delay': `${thought.delay}s`,
                animationDuration: `${thought.duration}s`,
                animationDelay: `${thought.delay}s`,
              } as React.CSSProperties
            }
          >
            <span
              className={`font-mono leading-relaxed whitespace-nowrap ${
                thought.size === 'base'
                  ? 'text-[11px]'
                  : thought.size === 'sm'
                    ? 'text-[10px]'
                    : 'text-[9px]'
              }`}
              style={{
                color: `rgba(52, 211, 153, ${thought.opacity})`,
                textShadow:
                  thought.opacity > 0.2
                    ? `0 0 12px rgba(52, 211, 153, ${thought.opacity * 0.15})`
                    : 'none',
              }}
            >
              {thought.text}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom fade overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32"
        style={{
          background: 'linear-gradient(to top, var(--color-bg-base), transparent)',
        }}
      />
    </div>
  );
}
