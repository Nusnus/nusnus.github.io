/**
 * GitHub data endpoints for the Cloudflare Worker.
 * Fetches from GitHub REST + GraphQL APIs with a PAT (5,000 req/hr).
 * Responses are cached via Cloudflare Cache API (free, edge-cached).
 *
 * Routes: GET /github/profile|repos|org-repos|activity|contributions
 */

import {
  GITHUB_USERNAME,
  CELERY_REPOS,
  CELERY_ORG_REPOS,
  REPO_ROLES,
  isKnownPublicRepo,
} from '../../shared/github-config';

const GITHUB_API = 'https://api.github.com';
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

const TTL: Record<string, number> = {
  profile: 3600,
  repos: 900,
  'org-repos': 900,
  activity: 300,
  contributions: 3600,
  meta: 60,
};

// ─── Types ───────────────────────────────────────────────────────────

interface RepoData {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: string;
  language: string | null;
  role: string;
  contributorRank?: number;
}

interface ActivityEvent {
  id: string;
  type: string;
  repo: string;
  title: string;
  url: string;
  createdAt: string;
}

// ─── GitHub API helpers ──────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'nusnus-worker',
  };
}

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function ghFetchAll<T>(path: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await ghFetch<T[]>(`${path}${sep}per_page=100&page=${page}`, token);
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

// ─── Data fetchers ───────────────────────────────────────────────────

async function fetchProfile(token: string) {
  const d = await ghFetch<Record<string, unknown>>(`/users/${GITHUB_USERNAME}`, token);
  return {
    login: d.login,
    name: d.name ?? GITHUB_USERNAME,
    bio: d.bio ?? '',
    avatarUrl: d.avatar_url,
    htmlUrl: d.html_url,
    followers: d.followers,
    publicRepos: d.public_repos,
  };
}

async function fetchContributorRank(o: string, r: string, t: string): Promise<number | undefined> {
  try {
    const c = await ghFetchAll<{ login: string }>(`/repos/${o}/${r}/contributors`, t);
    const idx = c.findIndex((x) => x.login === GITHUB_USERNAME);
    return idx >= 0 ? idx + 1 : undefined;
  } catch {
    return undefined;
  }
}

async function fetchRepoList(repoList: string[], token: string): Promise<RepoData[]> {
  // Fetch all repos in parallel for much faster response times
  const results = await Promise.allSettled(
    repoList.map(async (fullName) => {
      const [owner = '', repo = ''] = fullName.split('/');
      const [d, rank] = await Promise.all([
        ghFetch<Record<string, unknown>>(`/repos/${owner}/${repo}`, token),
        fetchContributorRank(owner, repo, token),
      ]);
      return {
        name: d.name as string,
        fullName: d.full_name as string,
        description: (d.description as string) ?? '',
        htmlUrl: d.html_url as string,
        stars: d.stargazers_count as number,
        forks: d.forks_count as number,
        openIssues: d.open_issues_count as number,
        lastPush: (d.pushed_at as string) ?? new Date().toISOString(),
        language: (d.language as string | null) ?? null,
        role: REPO_ROLES[fullName] ?? 'contributor',
        ...(rank != null ? { contributorRank: rank } : {}),
      };
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<RepoData> => r.status === 'fulfilled')
    .map((r) => r.value);
}

async function fetchActivity(token: string) {
  const events: ActivityEvent[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await ghFetch<Record<string, unknown>[]>(
      `/users/${GITHUB_USERNAME}/events/public?per_page=100&page=${page}`,
      token,
    );
    for (const event of data) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const eventType = (event.type as string) ?? 'Unknown';
      const repoName = (event.repo as Record<string, string>)?.name ?? '';
      let title = eventType.replace('Event', '');
      let url = `https://github.com/${repoName}`;
      if (eventType === 'PushEvent') {
        const commits = (payload.commits as { message: string }[]) ?? [];
        title = commits[0]?.message ?? 'Push';
      } else if (eventType === 'PullRequestEvent') {
        const pr = payload.pull_request as { title: string; html_url: string } | undefined;
        title = pr?.title ?? 'Pull Request';
        url = pr?.html_url ?? url;
      } else if (eventType === 'PullRequestReviewEvent') {
        const pr = payload.pull_request as { title: string; html_url: string } | undefined;
        title = `Review: ${pr?.title ?? 'PR'}`;
        url = pr?.html_url ?? url;
      } else if (eventType === 'IssueCommentEvent') {
        const issue = payload.issue as { title: string } | undefined;
        const comment = payload.comment as { html_url: string } | undefined;
        title = `Comment: ${issue?.title ?? 'Issue'}`;
        url = comment?.html_url ?? url;
      }
      // Defense-in-depth: redact repo names from unknown owners
      const safeRepo = isKnownPublicRepo(repoName) ? repoName : 'Private Project';
      const safeTitle = isKnownPublicRepo(repoName) ? title : eventType.replace('Event', '');
      const safeUrl = isKnownPublicRepo(repoName)
        ? url
        : `https://github.com/${repoName.split('/')[0]}`;

      events.push({
        id: event.id as string,
        type: eventType,
        repo: safeRepo,
        title: safeTitle,
        url: safeUrl,
        createdAt: (event.created_at as string) ?? new Date().toISOString(),
      });
    }
    if (data.length < 100) break;
  }
  const today = new Date().toISOString().split('T')[0] ?? '';
  const todayEvents = events.filter((e) => e.createdAt.startsWith(today));
  return {
    events,
    todaySummary: {
      commits: todayEvents.filter((e) => e.type === 'PushEvent').length,
      prsOpened: todayEvents.filter((e) => e.type === 'PullRequestEvent').length,
      prsReviewed: todayEvents.filter((e) => e.type === 'PullRequestReviewEvent').length,
      issueComments: todayEvents.filter((e) => e.type === 'IssueCommentEvent').length,
    },
  };
}

async function fetchContributions(token: string) {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const query = `query($username:String!,$from:DateTime!,$to:DateTime!){user(login:$username){contributionsCollection(from:$from,to:$to){contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions}}}`;
  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: {
        username: GITHUB_USERNAME,
        from: oneYearAgo.toISOString(),
        to: now.toISOString(),
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL: ${res.status}`);
  const json = (await res.json()) as {
    data: { user: { contributionsCollection: Record<string, unknown> } };
  };
  const c = json.data.user.contributionsCollection;
  const cal = c.contributionCalendar as { totalContributions: number; weeks: unknown[] };
  return {
    totalContributions: cal.totalContributions,
    totalCommits: c.totalCommitContributions,
    totalPRs: c.totalPullRequestContributions,
    totalReviews: c.totalPullRequestReviewContributions,
    totalIssues: c.totalIssueContributions,
    weeks: cal.weeks,
  };
}

// ─── Route handler ───────────────────────────────────────────────────

type Fetcher = (token: string) => Promise<unknown>;

const ROUTES: Record<string, Fetcher> = {
  '/github/profile': fetchProfile,
  '/github/repos': (t) => fetchRepoList(CELERY_REPOS, t),
  '/github/org-repos': (t) => fetchRepoList(CELERY_ORG_REPOS, t),
  '/github/activity': fetchActivity,
  '/github/contributions': fetchContributions,
  '/github/meta': () => Promise.resolve({ lastUpdated: new Date().toISOString(), status: 'ok' }),
};

export async function handleGitHubRoute(
  request: Request,
  token: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const url = new URL(request.url);
  const fetcher = ROUTES[url.pathname];
  if (!fetcher) return null;

  const routeKey = url.pathname.replace('/github/', '');
  const ttl = TTL[routeKey] ?? 900;

  // Check Cloudflare Cache API (caches.default is Cloudflare-specific)
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, { status: 200, headers });
  }

  // Cache miss — fetch from GitHub
  try {
    const data = await fetcher(token);
    const body = JSON.stringify(data);
    // Store in cache (non-blocking)
    void cache.put(
      cacheKey,
      new Response(body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` },
      }),
    );
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`,
        'X-Cache': 'MISS',
        ...corsHeaders,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub fetch failed';
    console.error(`[github] ${url.pathname}: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
