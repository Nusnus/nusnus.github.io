/**
 * ThoughtsPanel — Matrix-style floating AI thoughts about Tomer.
 *
 * Displays a stream of witty, data-driven observations that fall like
 * Matrix digital rain. Each thought fades in at the top, drifts down,
 * and fades out at the bottom. Only visible on wide screens (xl+).
 *
 * Supports two instances (left + right) with non-overlapping text pools.
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
 * Generated from real GitHub data, persona.md, and knowledge.md.
 * Split into two pools so left and right panels never show the same text.
 */

/** Pool A — used by the LEFT panel */
const THOUGHTS_A: string[] = [
  '2,507 contributions this year and counting',
  '234 commits • 123 PRs • 138 reviews • 0 issues filed',
  '28,204 stars on celery/celery alone',
  'kombu: 3,106 stars • 987 forks',
  '112 followers. Quality over quantity.',
  'pytest-celery: 79 stars, 19 forks, 7 issues. Lean.',
  '40 contributions on a Sunday. Touch grass? No.',
  '#3 all-time contributor to a 28K-star project',
  'celery.apply_async(roast_tomer, countdown=0)',
  'CEO & Tech Lead, Celery Organization',
  'pytest-celery: built from scratch, by one person',
  'RabbitMQ, Redis, SQS... he speaks fluent broker',
  'kombu: messaging done right™',
  'The Matrix has him... writing task queues',
  'django-celery-beat: cron jobs with an ORM',
  'py-amqp: AMQP 0-9-1 in pure Python',
  'sphinx_celery: even the docs have infrastructure',
  "Instagram runs on Celery. You're welcome.",
  'Robinhood runs on Celery. Stonks go async.',
  'result = celery.send_task("be_awesome")',
  'from celery import shared_task  # sharing is caring',
  'CELERY_ALWAYS_EAGER=False  // never take shortcuts',
  'async def life(): await celery.run()',
  'if not task.ready(): task.retry()',
  "pip install celery  # 28K people can't be wrong",
  'pytest --celery -x -v  // trust but verify',
  'class Nusnus(Developer, Artist, Architect): ...',
  'try: sleep(8) except CeleryException: commit()',
  'assert contributions > 2500  # passes annually',
  'raise NotImplementedError("saying no to PRs")',
  'print("Hello World")  # his first line, age 15',
  'subprocess.run(["make", "history"])',
  '"What is real?" — Morpheus, 1999',
  'The Oracle of distributed task queues',
  'Herzliya, IL → The Matrix',
  'There is no spoon. There is only celery.',
  'The Architect designed the Matrix. Tomer designed pytest-celery.',
  '"I know kung fu" → "I know AMQP 0-9-1"',
  'Morpheus: "He is The One." GitHub: "He is #3."',
  'The Matrix runs on mainframes. Celery runs on everything.',
  'Trinity hacks the grid. Tomer hacks the queue.',
  'The Matrix has you → The terminal has you',
  'Commits at 2 AM on a Monday. Normal Tuesday.',
  'Hebrew, English, Spanish: trilingual dev',
  'Mamram graduate — IDF elite programming unit',
  'E2E thinking: inception to deployment to maintenance',
  '"I see myself as an artist and my art comes in the form of code"',
  'Sleep schedule: undefined',
  'Merge conflicts are just creative differences',
  'His .gitconfig is older than some developers',
  "Discovered programming at 15. World hasn't recovered.",
  'Python at the CPython level',
  'Docker containers for breakfast, Kubernetes for lunch',
  'TypeScript + React + Astro 5 for the frontend',
  'GitHub Actions: his other CI/CD',
  'PyPI publisher. Package maintainer. Release engineer.',
  'Cybersecurity background at CYE',
  'Playwright + pytest + Docker + Jenkins → TestHub',
  'Loading professional universe...',
  'Analyzing commit patterns... impressive',
  'Indexing 28,204 stargazers...',
  'Running inference on career trajectory...',
  'Resolving dependency tree... 0 conflicts',
  'Syncing neural weights with GitHub API...',
  'Establishing secure connection to the Matrix...',
  'Streaming consciousness v2.0...',
  'Optimizing query: SELECT * FROM achievements',
  'Open source is not a hobby, it is a calling',
  'nusnus.github.io > linkedin  // the upgrade',
  'Cognition AI recognized his contributions',
  'His GitHub is his resume. His resume is green.',
  'Seniority level: the git blame traces back to him',
  'PR reviews: where good code becomes great code',
  'Open source maintainer: unpaid, unstoppable, unmatched',
  'Dependabot sends him thank-you notes',
  'npm has left-pad. Python has Celery. Different league.',
  '"Just one more commit" — famous last words, every night',
  'Fork it. Star it. Contribute. In that order.',
  'Celery: making Python async before it was cool',
  '28K stars. Still responds to issues personally.',
  'Every PR tells a story. His tell an epic.',
];

/** Pool B — used by the RIGHT panel */
const THOUGHTS_B: string[] = [
  '100 contributions in a single day. June 15. A Sunday.',
  'Zero issues opened. He just fixes things.',
  '4,986 forks of Celery. An army of task queues.',
  '773 open issues on Celery. Job security.',
  '19 public repos. 10+ in the Celery org.',
  '57 contributions on June 12. It was a Thursday.',
  'Averaged 48 contributions/week in June 2025',
  'git log --author="Nusnus" | wc -l  // too many',
  'billiard > multiprocessing  // fork the fork',
  'Celery v5.5.0 release manager. March 2025.',
  'django-celery-results: because you need receipts',
  'vine: promises for people who keep them',
  'celeryproject.org: yes, he manages the website too',
  "Mozilla runs on Celery. You're welcome again.",
  'One man. Ten repos. Zero excuses.',
  '@app.task(bind=True, max_retries=∞)',
  'worker.ready() → career.ready()',
  'broker_connection_retry_on_startup=True  // persistent',
  'import celery; import life  # same thing',
  'git rebase -i HEAD~life  // interactive mode',
  'docker compose up -d broker worker  // breakfast',
  '>>> from kombu import Exchange, Queue',
  'while True: review_prs(); merge(); release()',
  'def contribute(): return never_stop()',
  '# TODO: take a vacation (opened 2019, still open)',
  'git commit -m "fix: fix the fix of the fix"',
  'os.environ["LIFE"] = "open_source"',
  'Neo dodges bullets; Tomer dodges merge conflicts',
  'Building the simulation from inside the simulation',
  'Follow the white rabbit → Follow the green commits',
  'He took the green pill. Obviously.',
  'Free your mind. Use async task queues.',
  'The One who manages the task queue',
  'Red pill: corporate job. Green pill: open source.',
  'Agent Smith replicates. Celery workers scale.',
  "Resurrections? We don't talk about that one.",
  '"Mr. Anderson..." → "Mr. Nosrati..."',
  '"The 4th commit is always a refactor"',
  'Point-First Approach: lead with the conclusion',
  'The man who cannot say no to a pull request',
  'Started coding at 15. Never stopped.',
  'His IDE has more tabs open than his browser',
  'Work-life balance: { work: 1.0, life: work }',
  'Reviews PRs faster than most people write them',
  'Bio: "Artist." Medium: "Python."',
  'Distributed systems architect by day and night',
  'CI/CD pipeline whisperer',
  'Message broker polyglot: AMQP, Redis, SQS, Kafka',
  'Blacksmith CI partnership: speed matters',
  "Testing philosophy: if it's not tested, it's broken",
  'Built TestHub: E2E web testing from scratch',
  'Scanning GitHub contribution graph...',
  'Cross-referencing repo dependencies...',
  'Processing open source karma...',
  'Calibrating contribution heatmap...',
  'Fetching live data from the simulation...',
  'Compiling achievement list... stack overflow',
  'Parsing 12 months of commit history...',
  'Decrypting contribution patterns...',
  'Rendering developer profile at 60fps...',
  'Nusnus: a handle that needs no explanation',
  'Achievement unlocked: mass adoption',
  'Powered by xAI Grok — naturally',
  'Stack overflow: not the error, the knowledge',
  'Some people count sheep. He counts commits.',
  "The contribution graph is not a suggestion. It's a lifestyle.",
  'Most devs have a comfort zone. His is the terminal.',
  "He doesn't git push --force. He doesn't need to.",
  "The only merge conflict he can't resolve: sleep vs. code",
  'README.md: "Installation: pip install celery. You\'re done."',
  'His notifications tab is a full-time job',
  'GitHub Copilot learned from his code',
  "If commits were currency, he'd be on Forbes",
  'The green squares on his graph? Not grass. Greener.',
  'He treats code reviews like wine tasting. Thorough.',
  'Documentation: the love language of maintainers',
  'His keyboard has a commit-shaped dent in the Enter key',
  'Open source: where your boss is the community',
  'The man behind the @ in your @app.task decorator',
  'Release day is his Christmas. Happens more often.',
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
    opacity: 0.3 + Math.random() * 0.3,
  };
}

const INITIAL_COUNT = 8;

/** Generate the initial batch of thoughts staggered in time. */
function createInitialThoughts(pool: string[]): FloatingThought[] {
  const shuffled = shuffle(pool);
  const out: FloatingThought[] = [];
  for (let i = 0; i < INITIAL_COUNT; i++) {
    const text = shuffled[i] ?? pool[0] ?? '';
    out.push(buildThought(i, text, i * 2.5));
  }
  return out;
}

interface ThoughtsPanelProps {
  /** Which side of the chat this panel sits on. Controls text pool and fade direction. */
  side?: 'left' | 'right';
}

export function ThoughtsPanel({ side = 'right' }: ThoughtsPanelProps) {
  const pool = side === 'left' ? THOUGHTS_A : THOUGHTS_B;

  const [thoughts, setThoughts] = useState<FloatingThought[]>(() => createInitialThoughts(pool));
  const nextIdRef = useRef(INITIAL_COUNT);
  const shuffledRef = useRef<string[]>(shuffle(pool));
  const indexRef = useRef(INITIAL_COUNT);

  /** Pick next thought text (cycles through shuffled pool). */
  const nextThought = useCallback((): string => {
    if (indexRef.current >= shuffledRef.current.length) {
      shuffledRef.current = shuffle(pool);
      indexRef.current = 0;
    }
    const text = shuffledRef.current[indexRef.current] ?? '';
    indexRef.current++;
    return text;
  }, [pool]);

  useEffect(() => {
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

  // Fade edge: right panel fades on left edge, left panel fades on right edge
  const edgeFade =
    side === 'right' ? (
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
        style={{
          background: 'linear-gradient(to right, var(--color-bg-base), transparent)',
        }}
      />
    ) : (
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
        style={{
          background: 'linear-gradient(to left, var(--color-bg-base), transparent)',
        }}
      />
    );

  return (
    <div className="relative hidden h-full w-[300px] shrink-0 overflow-hidden xl:block">
      {/* Top/bottom gradient overlays */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-bg-base), transparent 20%, transparent 80%, var(--color-bg-base))',
        }}
      />
      {/* Inner edge fade — subtle, only shades a letter or two */}
      {edgeFade}

      {/* Header — subtle, blends into background */}
      <div className="relative z-20 px-4 pt-4 pb-2">
        <div
          className={`flex items-center gap-2 ${side === 'left' ? 'justify-end' : 'justify-start'}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="bg-accent/40 absolute inline-flex h-full w-full animate-ping rounded-full" />
            <span className="bg-accent/50 relative inline-flex h-1.5 w-1.5 rounded-full" />
          </span>
          <span className="text-accent/40 font-mono text-[10px] tracking-widest uppercase">
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
                  ? 'text-[13px]'
                  : thought.size === 'sm'
                    ? 'text-[11px]'
                    : 'text-[10px]'
              }`}
              style={{
                color: `rgba(52, 211, 153, ${thought.opacity})`,
                textShadow:
                  thought.opacity > 0.2
                    ? `0 0 12px rgba(52, 211, 153, ${thought.opacity * 0.25})`
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
