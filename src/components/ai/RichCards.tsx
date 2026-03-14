/**
 * RichCards — Dynamic visual rendering components for Cybernus chat.
 *
 * These components render rich visual content inline in chat messages
 * when triggered by MCP-style tool calls (show_github_stats, show_project_card,
 * show_timeline). They use the site's Matrix theme and are fully responsive.
 */

import { cn } from '@lib/utils/cn';

/* ─── GitHub Stats Card ─── */

interface GitHubStatsProps {
  username: string;
  publicRepos: string;
  followers: string;
  totalStars: string;
  contributions: string;
  topLanguage?: string | undefined;
}

export function GitHubStatsCard({
  username,
  publicRepos,
  followers,
  totalStars,
  contributions,
  topLanguage,
}: GitHubStatsProps) {
  const stats = [
    { label: 'Repos', value: publicRepos, icon: '📦' },
    { label: 'Stars', value: totalStars, icon: '⭐' },
    { label: 'Followers', value: followers, icon: '👥' },
    { label: 'Contributions', value: contributions, icon: '🔥' },
  ];

  return (
    <div className="border-accent/30 bg-bg-surface/80 my-3 overflow-hidden rounded-xl border backdrop-blur-sm">
      {/* Header */}
      <div className="border-accent/20 bg-accent/5 flex items-center gap-3 border-b px-4 py-3">
        <div className="bg-accent/20 flex h-10 w-10 items-center justify-center rounded-full">
          <svg className="text-accent h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </div>
        <div>
          <h3 className="text-text-primary text-sm font-bold">@{username}</h3>
          {topLanguage && <p className="text-text-muted text-xs">Primary: {topLanguage}</p>}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-surface/80 flex flex-col items-center gap-1 px-4 py-3"
          >
            <span className="text-lg">{stat.icon}</span>
            <span className="text-accent text-lg font-bold tabular-nums">{stat.value}</span>
            <span className="text-text-muted text-[10px] tracking-wider uppercase">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Project Card ─── */

interface ProjectCardProps {
  name: string;
  description: string;
  url: string;
  stars?: string | undefined;
  forks?: string | undefined;
  language?: string | undefined;
  role?: string | undefined;
}

export function ProjectCard({
  name,
  description,
  url,
  stars,
  forks,
  language,
  role,
}: ProjectCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'border-accent/30 bg-bg-surface/80 group my-3 block overflow-hidden rounded-xl border backdrop-blur-sm',
        'hover:border-accent/60 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/5',
      )}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-accent group-hover:text-accent/80 truncate text-sm font-bold transition-colors">
              {name}
            </h3>
            {role && (
              <span className="bg-accent/10 text-accent mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium">
                {role}
              </span>
            )}
          </div>
          <svg
            className="text-text-muted h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </div>

        {/* Description */}
        <p className="text-text-secondary mt-2 line-clamp-2 text-xs leading-relaxed">
          {description}
        </p>

        {/* Footer stats */}
        <div className="mt-3 flex items-center gap-4">
          {language && (
            <span className="text-text-muted flex items-center gap-1 text-[10px]">
              <span className="bg-accent h-2 w-2 rounded-full" />
              {language}
            </span>
          )}
          {stars && (
            <span className="text-text-muted flex items-center gap-1 text-[10px]">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
              </svg>
              {stars}
            </span>
          )}
          {forks && (
            <span className="text-text-muted flex items-center gap-1 text-[10px]">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v6m0 0 6-6m0 0h6" />
              </svg>
              {forks}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

/* ─── Timeline ─── */

interface TimelineEvent {
  date: string;
  title: string;
  description?: string | undefined;
  type?: 'milestone' | 'release' | 'achievement' | 'career' | undefined;
}

interface TimelineProps {
  title: string;
  events: TimelineEvent[];
}

const TYPE_COLORS: Record<string, string> = {
  milestone: 'bg-accent',
  release: 'bg-blue-400',
  achievement: 'bg-yellow-400',
  career: 'bg-purple-400',
};

export function Timeline({ title, events }: TimelineProps) {
  return (
    <div className="border-accent/30 bg-bg-surface/80 my-3 overflow-hidden rounded-xl border backdrop-blur-sm">
      {/* Header */}
      <div className="border-accent/20 bg-accent/5 border-b px-4 py-3">
        <h3 className="text-accent text-sm font-bold">{title}</h3>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="bg-accent/20 absolute top-0 bottom-0 left-[7px] w-px" />

          <div className="space-y-4">
            {events.map((event, i) => {
              const dotColor = TYPE_COLORS[event.type ?? 'milestone'] ?? 'bg-accent';
              return (
                <div key={i} className="relative flex gap-4 pl-6">
                  {/* Dot */}
                  <div
                    className={cn(
                      'absolute top-1.5 left-0 h-[15px] w-[15px] rounded-full border-2 border-black/50',
                      dotColor,
                    )}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-text-primary text-sm font-medium">{event.title}</span>
                      <span className="text-text-muted text-[10px] tabular-nums">{event.date}</span>
                    </div>
                    {event.description && (
                      <p className="text-text-secondary mt-0.5 text-xs leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Component type resolver ─── */

interface RichComponentProps {
  componentType: string;
  props: Record<string, string>;
}

/**
 * Resolve a component type string to the actual React component.
 * Called from ChatMessages when a render_component action is encountered.
 */
export function RichComponent({ componentType, props }: RichComponentProps) {
  switch (componentType) {
    case 'github_stats':
      return (
        <GitHubStatsCard
          username={props['username'] ?? 'Nusnus'}
          publicRepos={props['public_repos'] ?? '0'}
          followers={props['followers'] ?? '0'}
          totalStars={props['total_stars'] ?? '0'}
          contributions={props['contributions'] ?? '0'}
          topLanguage={props['top_language']}
        />
      );
    case 'project_card':
      return (
        <ProjectCard
          name={props['name'] ?? 'Unknown'}
          description={props['description'] ?? ''}
          url={props['url'] ?? '#'}
          stars={props['stars']}
          forks={props['forks']}
          language={props['language']}
          role={props['role']}
        />
      );
    case 'timeline': {
      // Parse events from JSON string prop
      let events: TimelineEvent[] = [];
      try {
        events = JSON.parse(props['events'] ?? '[]') as TimelineEvent[];
      } catch {
        // Invalid JSON — render empty
      }
      return <Timeline title={props['title'] ?? 'Timeline'} events={events} />;
    }
    default:
      return (
        <div className="text-text-muted my-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs">
          Unknown component: {componentType}
        </div>
      );
  }
}
