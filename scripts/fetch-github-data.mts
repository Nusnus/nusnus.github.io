import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ProfileData,
  RepoData,
  ActivityEvent,
  ActivityData,
  ContributionGraphData,
  MetaData,
} from '../src/lib/github/types.js';
import { CELERY_REPOS, REPO_ROLES, GITHUB_USERNAME } from '../src/lib/utils/constants.js';

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });
const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });
const OUTPUT_DIR = join(process.cwd(), 'public', 'data');

async function writeJson(filename: string, data: unknown): Promise<void> {
  await writeFile(join(OUTPUT_DIR, filename), JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✓ ${filename}`);
}

async function fetchProfile(): Promise<ProfileData> {
  const { data } = await octokit.users.getByUsername({ username: GITHUB_USERNAME });
  return {
    login: data.login,
    name: data.name ?? GITHUB_USERNAME,
    bio: data.bio ?? '',
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
    followers: data.followers,
    publicRepos: data.public_repos,
  };
}

async function fetchRepos(): Promise<RepoData[]> {
  const repos: RepoData[] = [];
  for (const fullName of CELERY_REPOS) {
    const parts = fullName.split('/');
    const owner = parts[0] ?? '';
    const repo = parts[1] ?? '';
    try {
      const { data } = await octokit.repos.get({ owner, repo });
      repos.push({
        name: data.name,
        fullName: data.full_name,
        description: data.description ?? '',
        htmlUrl: data.html_url,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        lastPush: data.pushed_at ?? new Date().toISOString(),
        language: data.language,
        role: REPO_ROLES[fullName] ?? 'contributor',
      });
    } catch (error) {
      console.warn(`  ⚠ Failed to fetch ${fullName}:`, error);
    }
  }
  return repos;
}

async function fetchActivity(): Promise<ActivityData> {
  const events: ActivityEvent[] = [];
  for (let page = 1; page <= 3; page++) {
    const { data } = await octokit.activity.listPublicEventsForUser({
      username: GITHUB_USERNAME,
      per_page: 100,
      page,
    });
    for (const event of data) {
      const payload = event.payload as Record<string, unknown>;
      let title = event.type?.replace('Event', '') ?? 'Activity';
      let url = `https://github.com/${event.repo.name}`;

      if (event.type === 'PushEvent') {
        const commits = (payload.commits as { message: string }[]) ?? [];
        title = commits[0]?.message ?? 'Push';
      } else if (event.type === 'PullRequestEvent') {
        const pr = payload.pull_request as { title: string; html_url: string } | undefined;
        title = pr?.title ?? 'Pull Request';
        url = pr?.html_url ?? url;
      } else if (event.type === 'PullRequestReviewEvent') {
        const pr = payload.pull_request as { title: string; html_url: string } | undefined;
        title = `Review: ${pr?.title ?? 'PR'}`;
        url = pr?.html_url ?? url;
      } else if (event.type === 'IssueCommentEvent') {
        const issue = payload.issue as { title: string } | undefined;
        const comment = payload.comment as { html_url: string } | undefined;
        title = `Comment: ${issue?.title ?? 'Issue'}`;
        url = comment?.html_url ?? url;
      }

      events.push({
        id: event.id,
        type: event.type ?? 'Unknown',
        repo: event.repo.name,
        title,
        url,
        createdAt: event.created_at ?? new Date().toISOString(),
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

async function fetchContributionGraph(): Promise<ContributionGraphData> {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  interface GQLResponse {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: {
            contributionDays: {
              contributionCount: number;
              date: string;
              weekday: number;
            }[];
          }[];
        };
        totalCommitContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        totalIssueContributions: number;
      };
    };
  }

  const response = await gql<GQLResponse>(
    `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalIssueContributions
        }
      }
    }
  `,
    {
      username: GITHUB_USERNAME,
      from: oneYearAgo.toISOString(),
      to: now.toISOString(),
    },
  );

  const collection = response.user.contributionsCollection;
  return {
    totalContributions: collection.contributionCalendar.totalContributions,
    totalCommits: collection.totalCommitContributions,
    totalPRs: collection.totalPullRequestContributions,
    totalReviews: collection.totalPullRequestReviewContributions,
    totalIssues: collection.totalIssueContributions,
    weeks: collection.contributionCalendar.weeks,
  };
}

// ─── Main ───

async function main(): Promise<void> {
  console.log('🔄 Fetching GitHub data...\n');
  await mkdir(OUTPUT_DIR, { recursive: true });

  const results = await Promise.allSettled([
    fetchProfile().then((data) => writeJson('profile.json', data)),
    fetchRepos().then((data) => writeJson('repos.json', data)),
    fetchActivity().then((data) => writeJson('activity.json', data)),
    fetchContributionGraph().then((data) => writeJson('contribution-graph.json', data)),
  ]);

  const meta: MetaData = {
    lastUpdated: new Date().toISOString(),
    status: results.map((r) => r.status),
  };
  await writeJson('meta.json', meta);

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`\n⚠️  ${failures.length} fetch(es) failed:`);
    for (const f of failures) {
      if (f.status === 'rejected') console.error(' ', f.reason);
    }
    process.exit(1);
  }

  console.log('\n✅ GitHub data updated successfully');
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
