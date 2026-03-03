import { initAnimations } from './animations.js';
import { fetchStats } from './data.js';
import {
    renderBarChart,
    renderContributionHeatmap,
    renderDonutChart,
    renderEmptyChart,
    renderLineChart,
    renderYoyPills
} from './charts.js';
import {
    formatCompact,
    formatDate,
    formatNumber,
    formatRelativeDate,
    makeListItem,
    safeArray,
    setTextContent,
    sumBy
} from './utils.js';

function statFormat(value, mode) {
    if (mode === 'text') {
        return value || '—';
    }

    if (typeof value !== 'number') {
        return '—';
    }

    if (mode === 'compact') {
        return formatCompact(value);
    }

    return formatNumber(value);
}

function updateStatsBar(data) {
    const totals = data.totals || {};
    const fallbackStars = sumBy(data.repositories?.tracked || [], (repo) => Number(repo.stars) || 0);
    const fallbackDependents = sumBy(data.repositories?.tracked || [], (repo) => Number(repo.dependent_projects) || 0);

    const values = {
        total_stars: typeof totals.stars === 'number' ? totals.stars : fallbackStars,
        dependent_projects: typeof totals.dependent_projects === 'number' ? totals.dependent_projects : fallbackDependents,
        contributions: typeof totals.contributions === 'number' ? totals.contributions : data.contributions?.last_12_months?.total,
        most_active_since: data.contributions?.most_active_since
    };

    document.querySelectorAll('[data-stat-key]').forEach((node) => {
        const key = node.dataset.statKey;
        const mode = node.dataset.format;
        setTextContent(node, statFormat(values[key], mode));
    });

    if (data.last_updated) {
        setTextContent(document.getElementById('stats-updated'), `Stats updated ${formatDate(data.last_updated)}`);
    }
}

function updateHero(data) {
    const since = data.contributions?.most_active_since;

    setTextContent(
        document.querySelector('[data-most-active-since]'),
        since || 'Data unavailable'
    );
}

function updateProjectCards(data) {
    const repoMap = new Map();
    safeArray(data.repositories?.tracked).forEach((repo) => {
        if (repo && repo.name_with_owner) {
            repoMap.set(repo.name_with_owner.toLowerCase(), repo);
        }
    });

    document.querySelectorAll('[data-repo-stars]').forEach((node) => {
        const repo = repoMap.get(String(node.dataset.repoStars).toLowerCase());
        if (!repo || typeof repo.stars !== 'number') {
            return;
        }

        setTextContent(node, `★ ${formatCompact(repo.stars)}`);
    });

    document.querySelectorAll('[data-repo-forks]').forEach((node) => {
        const repo = repoMap.get(String(node.dataset.repoForks).toLowerCase());
        if (!repo || typeof repo.forks !== 'number') {
            return;
        }

        setTextContent(node, `⑂ ${formatCompact(repo.forks)}`);
    });
}

function renderProfilePanel(data) {
    const profile = data.profile || {};

    const accountAge = typeof profile.account_age_days === 'number'
        ? `${formatNumber(profile.account_age_days)} days`
        : (typeof profile.account_age_years === 'number' ? `${profile.account_age_years.toFixed(1)} years` : '—');

    const profileMetrics = {
        followers: profile.followers,
        following: profile.following,
        public_repos: profile.public_repos,
        account_age: accountAge,
        total_stars_received: profile.total_stars_received,
        organization_count: safeArray(profile.organizations).length
    };

    Object.entries(profileMetrics).forEach(([key, value]) => {
        const node = document.querySelector(`[data-profile="${key}"]`);
        if (!node) {
            return;
        }

        if (key === 'account_age') {
            setTextContent(node, value);
            return;
        }

        setTextContent(node, typeof value === 'number' ? formatNumber(value) : '—');
    });

    const orgList = document.getElementById('org-list');
    if (!orgList) {
        return;
    }

    const orgs = safeArray(profile.organizations);
    orgList.innerHTML = '';

    if (!orgs.length) {
        orgList.appendChild(makeListItem('No organizations found.'));
        return;
    }

    orgs.slice(0, 8).forEach((org) => {
        const login = org.login || 'org';
        const url = org.url || `https://github.com/${login}`;
        orgList.appendChild(makeListItem(`<a href="${url}" target="_blank" rel="noopener noreferrer">@${login}</a>`));
    });
}

function renderContributionPanel(data) {
    const last = data.contributions?.last_12_months || {};
    setTextContent(
        document.querySelector('[data-contrib-total]'),
        typeof last.total === 'number' ? `${formatNumber(last.total)} contributions` : 'Contributions unavailable'
    );

    const mapping = {
        current_streak: last.streaks?.current,
        longest_streak: last.streaks?.longest,
        commits: last.commits,
        prs: last.pull_requests,
        issues: last.issues,
        reviews: last.reviews
    };

    Object.entries(mapping).forEach(([key, value]) => {
        const node = document.querySelector(`[data-contrib="${key}"]`);
        if (!node) {
            return;
        }

        if (key.includes('streak') && typeof value === 'number') {
            setTextContent(node, `${formatNumber(value)} days`);
            return;
        }

        setTextContent(node, typeof value === 'number' ? formatNumber(value) : '—');
    });

    renderContributionHeatmap(document.getElementById('contribution-heatmap'), last.calendar);
    renderLineChart(document.getElementById('daily-trend-chart'), last.daily_trend, {
        ariaLabel: 'Daily contribution trend',
        emptyMessage: 'Daily trend unavailable'
    });
    renderBarChart(document.getElementById('weekly-trend-chart'), last.weekly_trend, {
        ariaLabel: 'Weekly contribution chart',
        emptyMessage: 'Weekly trend unavailable'
    });
    renderLineChart(document.getElementById('monthly-trend-chart'), last.monthly_trend, {
        ariaLabel: 'Monthly contribution trend',
        emptyMessage: 'Monthly trend unavailable',
        height: 120
    });
    renderYoyPills(document.getElementById('yoy-grid'), data.contributions?.year_over_year);
}

function renderRepositoryPanel(data) {
    const tracked = safeArray(data.repositories?.tracked);
    const tableBody = document.querySelector('#repo-table tbody');
    const summary = document.getElementById('repo-summary');
    if (!tableBody || !summary) {
        return;
    }

    summary.textContent = `Tracked repos: ${formatNumber(tracked.length)}`;

    if (!tracked.length) {
        tableBody.innerHTML = '<tr><td colspan="7">Repository data unavailable.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    tracked.slice(0, 15).forEach((repo) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="${repo.url}" target="_blank" rel="noopener noreferrer">${repo.name_with_owner}</a></td>
            <td>${formatNumber(repo.stars)}</td>
            <td>${formatNumber(repo.forks)}</td>
            <td>${formatNumber(repo.watchers)}</td>
            <td>${formatNumber(repo.open_issues)}</td>
            <td>${formatNumber(repo.open_prs)}</td>
            <td>${typeof repo.dependent_projects === 'number' ? formatNumber(repo.dependent_projects) : '—'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderLanguagePanel(data) {
    const languages = safeArray(data.repositories?.language_distribution);
    renderDonutChart(document.getElementById('language-donut'), languages);

    const legend = document.getElementById('language-legend');
    if (!legend) {
        return;
    }

    legend.innerHTML = '';

    if (!languages.length) {
        legend.appendChild(makeListItem('Language data unavailable.'));
        return;
    }

    const total = sumBy(languages, (language) => Number(language.bytes));
    languages.slice(0, 8).forEach((language) => {
        const pct = total > 0 ? ((Number(language.bytes) / total) * 100).toFixed(1) : '0.0';
        legend.appendChild(makeListItem(`
            <div class="legend-item">
                <span class="legend-dot" style="background:${language.color || '#6c9fff'}"></span>
                <span>${language.language} · ${pct}%</span>
            </div>
        `));
    });
}

function renderReleasesPanel(data) {
    const releases = safeArray(data.repositories?.recent_releases);
    const list = document.getElementById('release-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';

    if (!releases.length) {
        list.appendChild(makeListItem('Release data unavailable.'));
        return;
    }

    releases.slice(0, 10).forEach((release) => {
        const label = `${release.repo} · ${release.tag_name}`;
        const date = formatDate(release.published_at, { month: 'short', day: 'numeric' });
        list.appendChild(makeListItem(`<a href="${release.url}" target="_blank" rel="noopener noreferrer">${label} <small>(${date})</small></a>`));
    });
}

function renderActivityList(targetId, items, formatter) {
    const target = document.getElementById(targetId);
    if (!target) {
        return;
    }

    target.innerHTML = '';

    if (!items.length) {
        target.appendChild(makeListItem('No recent activity found.'));
        return;
    }

    items.slice(0, 12).forEach((item) => {
        target.appendChild(makeListItem(formatter(item)));
    });
}

function renderActivityPanel(data) {
    const activity = data.activity || {};

    renderActivityList('activity-commits', safeArray(activity.commits), (item) => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            <strong>${item.repo}</strong><br>
            ${item.message}<br>
            <small>${formatRelativeDate(item.date)}</small>
        </a>
    `);

    renderActivityList('activity-prs', safeArray(activity.pull_requests), (item) => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            <strong>${item.repo}</strong> · ${item.action}<br>
            ${item.title}<br>
            <small>${formatRelativeDate(item.date)}</small>
        </a>
    `);

    renderActivityList('activity-issues', safeArray(activity.issues), (item) => `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            <strong>${item.repo}</strong> · ${item.action}<br>
            ${item.title}<br>
            <small>${formatRelativeDate(item.date)}</small>
        </a>
    `);
}

function setDashboardStatus(message, isError = false) {
    const status = document.getElementById('dashboard-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle('error', isError);
}

function renderUnavailableState() {
    renderEmptyChart(document.getElementById('contribution-heatmap'), 'Data unavailable');
    renderEmptyChart(document.getElementById('daily-trend-chart'), 'Data unavailable');
    renderEmptyChart(document.getElementById('weekly-trend-chart'), 'Data unavailable');
    renderEmptyChart(document.getElementById('monthly-trend-chart'), 'Data unavailable');
    renderEmptyChart(document.getElementById('language-donut'), 'Data unavailable');

    setDashboardStatus('GitHub data is currently unavailable. Last successful dataset could not be loaded.', true);
}

async function bootstrap() {
    initAnimations();

    const result = await fetchStats();
    if (!result.ok) {
        document.body.classList.add('has-data');
        renderUnavailableState();
        return;
    }

    document.body.classList.add('has-data');

    const data = result.data;
    updateHero(data);
    updateStatsBar(data);
    updateProjectCards(data);
    renderProfilePanel(data);
    renderContributionPanel(data);
    renderRepositoryPanel(data);
    renderLanguagePanel(data);
    renderReleasesPanel(data);
    renderActivityPanel(data);

    setDashboardStatus(
        data.last_updated
            ? `Data source: GitHub API · Last updated ${formatDate(data.last_updated)}`
            : 'Data source: GitHub API · Timestamp unavailable'
    );
}

bootstrap();
