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
 * Generated from real GitHub data, persona.md, and knowledge.md.
 * Organized by category for maintainability but shuffled at runtime.
 */
const THOUGHTS: string[] = [
  // ── Real GitHub stats (from contribution-graph.json & repos.json) ──
  '2,507 contributions this year and counting',
  '100 contributions in a single day. June 15. A Sunday.',
  '234 commits • 123 PRs • 138 reviews • 0 issues filed',
  'Zero issues opened. He just fixes things.',
  '28,204 stars on celery/celery alone',
  '4,986 forks of Celery. An army of task queues.',
  'kombu: 3,106 stars • 987 forks',
  '773 open issues on Celery. Job security.',
  '112 followers. Quality over quantity.',
  '19 public repos. 10+ in the Celery org.',
  'pytest-celery: 79 stars, 19 forks, 7 issues. Lean.',
  '57 contributions on June 12. It was a Thursday.',
  '40 contributions on a Sunday. Touch grass? No.',
  'Averaged 48 contributions/week in June 2025',
  '#3 all-time contributor to a 28K-star project',

  // ── Celery ecosystem deep cuts ──
  'celery.apply_async(roast_tomer, countdown=0)',
  'CEO & Tech Lead, Celery Organization',
  'git log --author="Nusnus" | wc -l  // too many',
  'pytest-celery: built from scratch, by one person',
  'RabbitMQ, Redis, SQS... he speaks fluent broker',
  'kombu: messaging done right™',
  'billiard > multiprocessing  // fork the fork',
  'The Matrix has him... writing task queues',
  'Celery v5.5.0 release manager. March 2025.',
  'django-celery-beat: cron jobs with an ORM',
  'django-celery-results: because you need receipts',
  'py-amqp: AMQP 0-9-1 in pure Python',
  'vine: promises for people who keep them',
  'sphinx_celery: even the docs have infrastructure',
  'celeryproject.org: yes, he manages the website too',
  "Instagram runs on Celery. You're welcome.",
  "Mozilla runs on Celery. You're welcome again.",
  'Robinhood runs on Celery. Stonks go async.',
  'One man. Ten repos. Zero excuses.',
  'result = celery.send_task("be_awesome")',
  '@app.task(bind=True, max_retries=∞)',
  'from celery import shared_task  # sharing is caring',
  'worker.ready() → career.ready()',
  'CELERY_ALWAYS_EAGER=False  // never take shortcuts',
  'broker_connection_retry_on_startup=True  // persistent',

  // ── Code snippets as thoughts ──
  'async def life(): await celery.run()',
  'import celery; import life  # same thing',
  'if not task.ready(): task.retry()',
  'git rebase -i HEAD~life  // interactive mode',
  "pip install celery  # 28K people can't be wrong",
  'docker compose up -d broker worker  // breakfast',
  'pytest --celery -x -v  // trust but verify',
  '>>> from kombu import Exchange, Queue',
  'class Nusnus(Developer, Artist, Architect): ...',
  'while True: review_prs(); merge(); release()',
  'try: sleep(8) except CeleryException: commit()',
  'def contribute(): return never_stop()',
  'assert contributions > 2500  # passes annually',
  '# TODO: take a vacation (opened 2019, still open)',
  'raise NotImplementedError("saying no to PRs")',
  'git commit -m "fix: fix the fix of the fix"',
  'print("Hello World")  # his first line, age 15',
  'os.environ["LIFE"] = "open_source"',
  'subprocess.run(["make", "history"])',

  // ── Matrix references ──
  '"What is real?" — Morpheus, 1999',
  'Neo dodges bullets; Tomer dodges merge conflicts',
  'The Oracle of distributed task queues',
  'Building the simulation from inside the simulation',
  'Herzliya, IL → The Matrix',
  'Follow the white rabbit → Follow the green commits',
  'There is no spoon. There is only celery.',
  'He took the green pill. Obviously.',
  'The Architect designed the Matrix. Tomer designed pytest-celery.',
  'Free your mind. Use async task queues.',
  '"I know kung fu" → "I know AMQP 0-9-1"',
  'The One who manages the task queue',
  'Morpheus: "He is The One." GitHub: "He is #3."',
  'Red pill: corporate job. Green pill: open source.',
  'The Matrix runs on mainframes. Celery runs on everything.',
  'Agent Smith replicates. Celery workers scale.',
  'Trinity hacks the grid. Tomer hacks the queue.',
  "Resurrections? We don't talk about that one.",
  '"Mr. Anderson..." → "Mr. Nosrati..."',
  'The Matrix has you → The terminal has you',

  // ── Work ethic & personality ──
  'Commits at 2 AM on a Monday. Normal Tuesday.',
  '"The 4th commit is always a refactor"',
  'Hebrew, English, Spanish: trilingual dev',
  'Point-First Approach: lead with the conclusion',
  'Mamram graduate — IDF elite programming unit',
  'The man who cannot say no to a pull request',
  'E2E thinking: inception to deployment to maintenance',
  'Started coding at 15. Never stopped.',
  '"I see myself as an artist and my art comes in the form of code"',
  'His IDE has more tabs open than his browser',
  'Sleep schedule: undefined',
  'Work-life balance: { work: 1.0, life: work }',
  'Merge conflicts are just creative differences',
  'Reviews PRs faster than most people write them',
  'His .gitconfig is older than some developers',
  'Bio: "Artist." Medium: "Python."',
  "Discovered programming at 15. World hasn't recovered.",

  // ── Technical skills ──
  'Python at the CPython level',
  'Distributed systems architect by day and night',
  'Docker containers for breakfast, Kubernetes for lunch',
  'CI/CD pipeline whisperer',
  'TypeScript + React + Astro 5 for the frontend',
  'Message broker polyglot: AMQP, Redis, SQS, Kafka',
  'GitHub Actions: his other CI/CD',
  'Blacksmith CI partnership: speed matters',
  'PyPI publisher. Package maintainer. Release engineer.',
  "Testing philosophy: if it's not tested, it's broken",
  'Cybersecurity background at CYE',
  'Built TestHub: E2E web testing from scratch',
  'Playwright + pytest + Docker + Jenkins → TestHub',

  // ── Meta / system-style thoughts ──
  'Loading professional universe...',
  'Scanning GitHub contribution graph...',
  'Analyzing commit patterns... impressive',
  'Cross-referencing repo dependencies...',
  'Indexing 28,204 stargazers...',
  'Processing open source karma...',
  'Running inference on career trajectory...',
  'Calibrating contribution heatmap...',
  'Resolving dependency tree... 0 conflicts',
  'Fetching live data from the simulation...',
  'Syncing neural weights with GitHub API...',
  'Compiling achievement list... stack overflow',
  'Parsing 12 months of commit history...',
  'Establishing secure connection to the Matrix...',
  'Decrypting contribution patterns...',
  'Streaming consciousness v2.0...',
  'Rendering developer profile at 60fps...',
  'Optimizing query: SELECT * FROM achievements',

  // ── Witty one-liners / "matrix tweets" ──
  'Open source is not a hobby, it is a calling',
  'Nusnus: a handle that needs no explanation',
  'nusnus.github.io > linkedin  // the upgrade',
  'Achievement unlocked: mass adoption',
  'Cognition AI recognized his contributions',
  'Powered by xAI Grok — naturally',
  'Stack overflow: not the error, the knowledge',
  'His GitHub is his resume. His resume is green.',
  'Some people count sheep. He counts commits.',
  'Seniority level: the git blame traces back to him',
  "The contribution graph is not a suggestion. It's a lifestyle.",
  'Most devs have a comfort zone. His is the terminal.',
  'PR reviews: where good code becomes great code',
  "He doesn't git push --force. He doesn't need to.",
  "The only merge conflict he can't resolve: sleep vs. code",
  'README.md: "Installation: pip install celery. You\'re done."',
  'Open source maintainer: unpaid, unstoppable, unmatched',
  'His notifications tab is a full-time job',
  'Dependabot sends him thank-you notes',
  'GitHub Copilot learned from his code',
  'npm has left-pad. Python has Celery. Different league.',
  "If commits were currency, he'd be on Forbes",
  'The green squares on his graph? Not grass. Greener.',
  '"Just one more commit" — famous last words, every night',
  'He treats code reviews like wine tasting. Thorough.',
  'Documentation: the love language of maintainers',
  'Fork it. Star it. Contribute. In that order.',
  'His keyboard has a commit-shaped dent in the Enter key',
  'Celery: making Python async before it was cool',
  'Open source: where your boss is the community',
  '28K stars. Still responds to issues personally.',
  'The man behind the @ in your @app.task decorator',
  'Release day is his Christmas. Happens more often.',
  'Every PR tells a story. His tell an epic.',
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
    <div className="relative hidden h-full w-[340px] shrink-0 overflow-hidden xl:block">
      {/* Gradient overlays blend panel edges seamlessly into the chat background */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-bg-base), transparent 25%, transparent 75%, var(--color-bg-base))',
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
