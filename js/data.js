import { safeArray, safeObject } from './utils.js';

const DEFAULT_STATS = {
    last_updated: null,
    profile: {
        followers: null,
        following: null,
        public_repos: null,
        account_age_days: null,
        account_age_years: null,
        total_stars_received: null,
        organizations: [],
        html_url: 'https://github.com/Nusnus'
    },
    contributions: {
        last_12_months: {
            total: null,
            commits: null,
            pull_requests: null,
            issues: null,
            reviews: null,
            calendar: [],
            streaks: {
                current: null,
                longest: null
            },
            daily_trend: [],
            weekly_trend: [],
            monthly_trend: []
        },
        year_over_year: [],
        most_active_since: null
    },
    repositories: {
        tracked: [],
        language_distribution: [],
        recent_releases: [],
        dependents_total: null
    },
    activity: {
        commits: [],
        pull_requests: [],
        issues: []
    },
    totals: {
        stars: null,
        dependent_projects: null,
        contributions: null,
        followers: null
    }
};

function normalizeStats(raw) {
    const source = safeObject(raw);
    const normalized = structuredClone(DEFAULT_STATS);

    normalized.last_updated = source.last_updated || null;
    normalized.profile = { ...normalized.profile, ...safeObject(source.profile) };

    const contributions = safeObject(source.contributions);
    normalized.contributions = {
        ...normalized.contributions,
        ...contributions,
        last_12_months: {
            ...normalized.contributions.last_12_months,
            ...safeObject(contributions.last_12_months),
            streaks: {
                ...normalized.contributions.last_12_months.streaks,
                ...safeObject(safeObject(contributions.last_12_months).streaks)
            },
            calendar: safeArray(safeObject(contributions.last_12_months).calendar),
            daily_trend: safeArray(safeObject(contributions.last_12_months).daily_trend),
            weekly_trend: safeArray(safeObject(contributions.last_12_months).weekly_trend),
            monthly_trend: safeArray(safeObject(contributions.last_12_months).monthly_trend)
        },
        year_over_year: safeArray(contributions.year_over_year)
    };

    const repositories = safeObject(source.repositories);
    normalized.repositories = {
        ...normalized.repositories,
        ...repositories,
        tracked: safeArray(repositories.tracked),
        language_distribution: safeArray(repositories.language_distribution),
        recent_releases: safeArray(repositories.recent_releases)
    };

    const activity = safeObject(source.activity);
    normalized.activity = {
        ...normalized.activity,
        ...activity,
        commits: safeArray(activity.commits),
        pull_requests: safeArray(activity.pull_requests),
        issues: safeArray(activity.issues)
    };

    normalized.totals = { ...normalized.totals, ...safeObject(source.totals) };
    normalized.profile.organizations = safeArray(normalized.profile.organizations);

    return normalized;
}

export async function fetchStats() {
    try {
        const response = await fetch('data/stats.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch stats.json (${response.status})`);
        }

        const payload = await response.json();
        return {
            ok: true,
            data: normalizeStats(payload),
            error: null
        };
    } catch (error) {
        return {
            ok: false,
            data: structuredClone(DEFAULT_STATS),
            error
        };
    }
}
