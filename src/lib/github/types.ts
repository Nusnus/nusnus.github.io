// ─── GitHub REST API Response Types ───

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  language: string | null;
  topics: string[];
}

// ─── GitHub Event Types (discriminated union) ───

interface BaseEvent {
  id: string;
  type: string;
  repo: { id: number; name: string; url: string };
  created_at: string;
  actor: { login: string; avatar_url: string };
}

export interface PushEvent extends BaseEvent {
  type: 'PushEvent';
  payload: {
    ref: string;
    size: number;
    commits: {
      sha: string;
      message: string;
      url: string;
    }[];
  };
}

export interface PullRequestEvent extends BaseEvent {
  type: 'PullRequestEvent';
  payload: {
    action: string;
    number: number;
    pull_request: {
      title: string;
      html_url: string;
      state: string;
      merged: boolean;
    };
  };
}

export interface PullRequestReviewEvent extends BaseEvent {
  type: 'PullRequestReviewEvent';
  payload: {
    action: string;
    review: {
      state: string;
      html_url: string;
    };
    pull_request: {
      title: string;
      html_url: string;
      number: number;
    };
  };
}

export interface IssueCommentEvent extends BaseEvent {
  type: 'IssueCommentEvent';
  payload: {
    action: string;
    issue: {
      title: string;
      html_url: string;
      number: number;
    };
    comment: {
      html_url: string;
      body: string;
    };
  };
}

export interface CreateEvent extends BaseEvent {
  type: 'CreateEvent';
  payload: {
    ref: string | null;
    ref_type: string;
    description: string | null;
  };
}

export type GitHubEvent =
  | PushEvent
  | PullRequestEvent
  | PullRequestReviewEvent
  | IssueCommentEvent
  | CreateEvent
  | BaseEvent;

// ─── GitHub GraphQL Contribution Types ───

export interface ContributionDay {
  date: string;
  contributionCount: number;
  weekday: number;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

// ─── Processed Data File Types ───

export interface ProfileData {
  login: string;
  name: string;
  bio: string;
  avatarUrl: string;
  htmlUrl: string;
  followers: number;
  publicRepos: number;
}

export interface RepoData {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: string;
  language: string | null;
  role: 'owner' | 'lead' | 'creator' | 'contributor';
  contributorRank?: number | undefined;
}

export interface ActivityData {
  events: ActivityEvent[];
  todaySummary: {
    commits: number;
    prsOpened: number;
    prsReviewed: number;
    issueComments: number;
  };
}

export interface ContributionGraphData {
  totalContributions: number;
  totalCommits: number;
  totalPRs: number;
  totalReviews: number;
  totalIssues: number;
  weeks: ContributionWeek[];
}

export interface MetaData {
  lastUpdated: string;
  status: ('fulfilled' | 'rejected')[] | string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  repo: string;
  title: string;
  url: string;
  createdAt: string;
}
