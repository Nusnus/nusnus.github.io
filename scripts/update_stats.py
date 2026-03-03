#!/usr/bin/env python3
"""Refresh GitHub dashboard data and write data/stats.json (stdlib only)."""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_ROOT = "https://api.github.com"
GRAPHQL_ENDPOINT = f"{API_ROOT}/graphql"
USERNAME = "Nusnus"
USER_AGENT = "nusnus-github-dashboard-updater"
CORE_REPOS = [
    "celery/celery",
    "celery/pytest-celery",
    "celery/kombu",
]
TRACKED_REPO_LIMIT = 15

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "stats.json"


def isoformat_z(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def _request(url: str, token: str | None = None, *, method: str = "GET", payload: dict | None = None, accept: str = "application/vnd.github+json") -> tuple[str, dict]:
    headers = {
        "Accept": accept,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=45) as response:
        body = response.read().decode("utf-8")
        return body, dict(response.headers.items())


def rest_get(path: str, token: str | None, params: dict | None = None) -> dict:
    query = f"?{urlencode(params)}" if params else ""
    body, _ = _request(f"{API_ROOT}{path}{query}", token)
    return json.loads(body)


def rest_get_with_headers(path: str, token: str | None, params: dict | None = None) -> tuple[dict, dict]:
    query = f"?{urlencode(params)}" if params else ""
    body, headers = _request(f"{API_ROOT}{path}{query}", token)
    return json.loads(body), headers


def graphql(query: str, variables: dict, token: str | None) -> dict:
    body, _ = _request(GRAPHQL_ENDPOINT, token, method="POST", payload={"query": query, "variables": variables})
    payload = json.loads(body)
    if payload.get("errors"):
        raise RuntimeError(f"GraphQL errors: {payload['errors']}")
    return payload.get("data", {})


def request_html(url: str, token: str | None) -> str:
    body, _ = _request(url, token, accept="text/html")
    return body


def parse_compact_number(value: str) -> int:
    cleaned = value.strip().replace(",", "").replace("+", "").replace(" ", "").lower()
    if not cleaned:
        return 0

    mult = 1
    if cleaned.endswith("k"):
        mult = 1_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("m"):
        mult = 1_000_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("b"):
        mult = 1_000_000_000
        cleaned = cleaned[:-1]

    try:
        return int(float(cleaned) * mult)
    except ValueError:
        return 0


def load_existing() -> dict:
    if not OUTPUT_PATH.exists():
        return {}
    try:
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def extract_dependents_count(repo: str, token: str | None) -> tuple[int | None, str]:
    escaped = re.escape(repo)
    urls = [
        f"https://github.com/{repo}/network/dependents",
        f"https://github.com/{repo}",
    ]
    patterns = [
        rf"href=\"/{escaped}/network/dependents\"[^>]*>.*?Used by.*?<span[^>]*>([^<]+)</span>",
        r"Used by\s*([0-9][0-9.,]*[kKmMbB]?\+?)",
    ]

    for url in urls:
        html = request_html(url, token)
        text = re.sub(r"\s+", " ", html)
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if not match:
                continue
            value = parse_compact_number(match.group(1))
            if value > 0:
                return value, "github_dependents_html"

    return None, "unavailable"


def fetch_profile(token: str | None) -> dict:
    user = rest_get(f"/users/{USERNAME}", token)
    orgs = rest_get(f"/users/{USERNAME}/orgs", token, params={"per_page": 100})

    created_at = user.get("created_at")
    now = dt.datetime.now(dt.timezone.utc)
    age_days = None
    age_years = None
    if created_at:
        delta_days = (now - parse_iso(created_at)).days
        age_days = max(0, delta_days)
        age_years = round(age_days / 365.25, 2)

    return {
        "login": user.get("login"),
        "name": user.get("name"),
        "avatar_url": user.get("avatar_url"),
        "html_url": user.get("html_url"),
        "followers": user.get("followers"),
        "following": user.get("following"),
        "public_repos": user.get("public_repos"),
        "created_at": created_at,
        "account_age_days": age_days,
        "account_age_years": age_years,
        "organizations": [
            {
                "login": org.get("login"),
                "url": org.get("html_url"),
                "avatar_url": org.get("avatar_url"),
            }
            for org in orgs
            if org.get("login")
        ],
    }


CONTRIBUTIONS_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            weekday
          }
        }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner }
        contributions { totalCount }
      }
      issueContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner }
        contributions { totalCount }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner }
        contributions { totalCount }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner }
        contributions { totalCount }
      }
    }
  }
}
"""


def fetch_period_contributions(token: str | None, start: dt.datetime, end: dt.datetime) -> dict:
    data = graphql(
        CONTRIBUTIONS_QUERY,
        {
            "login": USERNAME,
            "from": isoformat_z(start),
            "to": isoformat_z(end),
        },
        token,
    )

    return (((data.get("user") or {}).get("contributionsCollection")) or {})


def extract_repo_scores(collection: dict) -> dict[str, int]:
    scores: dict[str, int] = {}

    keys = [
        "commitContributionsByRepository",
        "issueContributionsByRepository",
        "pullRequestContributionsByRepository",
        "pullRequestReviewContributionsByRepository",
    ]

    for key in keys:
        for row in collection.get(key, []) or []:
            repo = ((row.get("repository") or {}).get("nameWithOwner"))
            if not repo:
                continue
            count = int(((row.get("contributions") or {}).get("totalCount")) or 0)
            scores[repo] = scores.get(repo, 0) + count

    return scores


def compute_streaks(days: list[dict]) -> tuple[int, int]:
    if not days:
        return 0, 0

    sorted_days = sorted(days, key=lambda d: d.get("date", ""))

    longest = 0
    run = 0
    for day in sorted_days:
        count = int(day.get("count") or 0)
        if count > 0:
            run += 1
            longest = max(longest, run)
        else:
            run = 0

    current = 0
    for day in reversed(sorted_days):
        count = int(day.get("count") or 0)
        if count > 0:
            current += 1
        else:
            break

    return current, longest


def build_daily_trend(days: list[dict], window: int = 30) -> list[dict]:
    selected = sorted(days, key=lambda d: d.get("date", ""))[-window:]
    out = []
    for day in selected:
        out.append({
            "date": day.get("date"),
            "label": day.get("date"),
            "count": int(day.get("count") or 0),
        })
    return out


def build_weekly_trend(days: list[dict], weeks: int = 20) -> list[dict]:
    bucket: dict[str, int] = {}
    for day in days:
        date_str = day.get("date")
        if not date_str:
            continue
        date_obj = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
        start = date_obj - dt.timedelta(days=date_obj.weekday())
        key = start.isoformat()
        bucket[key] = bucket.get(key, 0) + int(day.get("count") or 0)

    out = [
        {
            "week_start": week,
            "label": week,
            "count": count,
        }
        for week, count in sorted(bucket.items())[-weeks:]
    ]
    return out


def build_monthly_trend(days: list[dict], months: int = 12) -> list[dict]:
    bucket: dict[str, int] = {}
    for day in days:
        date_str = day.get("date")
        if not date_str:
            continue
        key = date_str[:7]
        bucket[key] = bucket.get(key, 0) + int(day.get("count") or 0)

    out = [
        {
            "month": month_key,
            "label": month_key,
            "count": count,
        }
        for month_key, count in sorted(bucket.items())[-months:]
    ]
    return out


def fetch_year_over_year(token: str | None, now: dt.datetime) -> list[dict]:
    rows = []
    for year in [now.year - 1, now.year]:
        start = dt.datetime(year, 1, 1, tzinfo=dt.timezone.utc)
        end = dt.datetime(year, 12, 31, 23, 59, 59, tzinfo=dt.timezone.utc)
        if year == now.year:
            end = now

        collection = fetch_period_contributions(token, start, end)
        rows.append({
            "year": year,
            "total": int(((collection.get("contributionCalendar") or {}).get("totalContributions")) or 0),
            "commits": int(collection.get("totalCommitContributions") or 0),
            "pull_requests": int(collection.get("totalPullRequestContributions") or 0),
            "issues": int(collection.get("totalIssueContributions") or 0),
            "reviews": int(collection.get("totalPullRequestReviewContributions") or 0),
        })

    return rows


CONTRIBUTION_YEARS_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionYears
  }
}
"""


def fetch_core_active_since(token: str | None) -> str | None:
    data = graphql(CONTRIBUTION_YEARS_QUERY, {"login": USERNAME}, token)
    years = (((data.get("user") or {}).get("contributionYears")) or [])
    years = sorted(int(year) for year in years)

    for year in years:
        start = dt.datetime(year, 1, 1, tzinfo=dt.timezone.utc)
        end = dt.datetime(year, 12, 31, 23, 59, 59, tzinfo=dt.timezone.utc)
        collection = fetch_period_contributions(token, start, end)
        scores = extract_repo_scores(collection)
        if any(scores.get(repo, 0) > 0 for repo in CORE_REPOS):
            return f"Since {year}"

    return None


CONTRIBUTED_REPOS_QUERY = """
query($login: String!, $after: String) {
  user(login: $login) {
    repositoriesContributedTo(
      first: 100
      includeUserRepositories: true
      contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        nameWithOwner
        stargazerCount
      }
    }
  }
}
"""


def fetch_contributed_repos(token: str | None) -> tuple[list[dict], int]:
    repos = []
    cursor = None

    while True:
        data = graphql(CONTRIBUTED_REPOS_QUERY, {"login": USERNAME, "after": cursor}, token)
        conn = (((data.get("user") or {}).get("repositoriesContributedTo")) or {})
        nodes = conn.get("nodes") or []
        for node in nodes:
            if not node or not node.get("nameWithOwner"):
                continue
            repos.append({
                "name_with_owner": node.get("nameWithOwner"),
                "stars": int(node.get("stargazerCount") or 0),
            })

        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")
        if not cursor:
            break

    seen = set()
    dedup = []
    for repo in repos:
        name = repo["name_with_owner"].lower()
        if name in seen:
            continue
        seen.add(name)
        dedup.append(repo)

    total_stars = sum(repo["stars"] for repo in dedup)
    return dedup, total_stars


def fetch_recent_events(token: str | None) -> list[dict]:
    return rest_get(f"/users/{USERNAME}/events/public", token, params={"per_page": 100})


def extract_activity(events: list[dict]) -> dict:
    commits = []
    prs = []
    issues = []

    for event in events:
        event_type = event.get("type")
        repo = ((event.get("repo") or {}).get("name"))
        created = event.get("created_at")
        payload = event.get("payload") or {}

        if event_type == "PushEvent":
            for commit in payload.get("commits") or []:
                sha = commit.get("sha")
                message = (commit.get("message") or "").split("\n", 1)[0]
                if not sha:
                    continue
                commits.append({
                    "repo": repo,
                    "sha": sha,
                    "message": message,
                    "url": f"https://github.com/{repo}/commit/{sha}",
                    "date": created,
                })

        if event_type == "PullRequestEvent":
            pull_request = payload.get("pull_request") or {}
            action = payload.get("action")
            if action == "closed" and pull_request.get("merged"):
                action = "merged"
            prs.append({
                "repo": repo,
                "action": action,
                "title": pull_request.get("title"),
                "url": pull_request.get("html_url"),
                "number": pull_request.get("number"),
                "date": created,
            })

        if event_type == "PullRequestReviewEvent":
            review = payload.get("review") or {}
            pull_request = payload.get("pull_request") or {}
            prs.append({
                "repo": repo,
                "action": f"reviewed ({review.get('state', 'submitted').lower()})",
                "title": pull_request.get("title"),
                "url": pull_request.get("html_url"),
                "number": pull_request.get("number"),
                "date": created,
            })

        if event_type == "IssuesEvent":
            issue = payload.get("issue") or {}
            issues.append({
                "repo": repo,
                "action": payload.get("action"),
                "title": issue.get("title"),
                "url": issue.get("html_url"),
                "number": issue.get("number"),
                "date": created,
            })

        if event_type == "IssueCommentEvent":
            issue = payload.get("issue") or {}
            issue_url = issue.get("html_url") or ""
            if "/pull/" in issue_url:
                prs.append({
                    "repo": repo,
                    "action": "commented",
                    "title": issue.get("title"),
                    "url": issue_url,
                    "number": issue.get("number"),
                    "date": created,
                })
            else:
                issues.append({
                    "repo": repo,
                    "action": "commented",
                    "title": issue.get("title"),
                    "url": issue_url,
                    "number": issue.get("number"),
                    "date": created,
                })

    return {
        "commits": commits[:50],
        "pull_requests": prs[:50],
        "issues": issues[:50],
        "summary": {
            "events_analyzed": len(events),
        },
    }


def parse_link_last_page(link_header: str | None) -> int | None:
    if not link_header:
        return None

    matches = re.findall(r"<([^>]+)>;\s*rel=\"last\"", link_header)
    if not matches:
        return None

    url = matches[0]
    page_match = re.search(r"[?&]page=(\d+)", url)
    if not page_match:
        return None

    try:
        return int(page_match.group(1))
    except ValueError:
        return None


def fetch_open_pull_requests(repo: str, token: str | None) -> int:
    pulls, headers = rest_get_with_headers(f"/repos/{repo}/pulls", token, params={"state": "open", "per_page": 1})
    link = headers.get("Link") or headers.get("link")
    last = parse_link_last_page(link)
    if last is not None:
        return last
    return len(pulls) if isinstance(pulls, list) else 0


def fetch_repo_snapshot(repo: str, token: str | None) -> dict:
    repo_data = rest_get(f"/repos/{repo}", token)
    open_prs = fetch_open_pull_requests(repo, token)

    languages = rest_get(f"/repos/{repo}/languages", token)
    releases_raw = rest_get(f"/repos/{repo}/releases", token, params={"per_page": 3})
    releases = []
    if isinstance(releases_raw, list):
        for rel in releases_raw:
            releases.append({
                "tag_name": rel.get("tag_name"),
                "name": rel.get("name") or rel.get("tag_name"),
                "published_at": rel.get("published_at") or rel.get("created_at"),
                "url": rel.get("html_url"),
            })

    dependent_projects, dependent_method = extract_dependents_count(repo, token)

    open_issues_count = int(repo_data.get("open_issues_count") or 0)
    open_issues = max(0, open_issues_count - open_prs)

    return {
        "name_with_owner": repo,
        "name": repo_data.get("name"),
        "owner": (repo_data.get("owner") or {}).get("login"),
        "url": repo_data.get("html_url"),
        "description": repo_data.get("description"),
        "stars": int(repo_data.get("stargazers_count") or 0),
        "forks": int(repo_data.get("forks_count") or 0),
        "watchers": int(repo_data.get("subscribers_count") or 0),
        "open_issues": open_issues,
        "open_prs": int(open_prs),
        "primary_language": repo_data.get("language"),
        "languages": languages if isinstance(languages, dict) else {},
        "recent_releases": releases,
        "dependent_projects": dependent_projects,
        "dependent_source": dependent_method,
    }


def sort_repositories(candidates: set[str], scores: dict[str, int], stars_lookup: dict[str, int]) -> list[str]:
    def key(repo_name: str):
        lower = repo_name.lower()
        return (
            0 if lower in {r.lower() for r in CORE_REPOS} else 1,
            -scores.get(repo_name, 0),
            -(stars_lookup.get(lower, 0)),
            lower,
        )

    return sorted(candidates, key=key)


def aggregate_languages(repos: list[dict]) -> list[dict]:
    totals: dict[str, dict] = {}

    for repo in repos:
        for lang, size in (repo.get("languages") or {}).items():
            if not isinstance(size, int):
                continue
            entry = totals.setdefault(lang, {"language": lang, "bytes": 0, "color": "#6c9fff"})
            entry["bytes"] += size

    return sorted(totals.values(), key=lambda item: item["bytes"], reverse=True)


def flatten_releases(repos: list[dict]) -> list[dict]:
    releases = []
    for repo in repos:
        for rel in repo.get("recent_releases") or []:
            releases.append({
                "repo": repo.get("name_with_owner"),
                "tag_name": rel.get("tag_name"),
                "name": rel.get("name"),
                "published_at": rel.get("published_at"),
                "url": rel.get("url"),
            })

    releases.sort(key=lambda r: r.get("published_at") or "", reverse=True)
    return releases[:20]


def make_default_payload() -> dict:
    return {
        "last_updated": None,
        "meta": {
            "username": USERNAME,
            "source": "github_api",
            "generated_by": "scripts/update_stats.py",
            "data_version": 2,
        },
        "profile": {
            "followers": None,
            "following": None,
            "public_repos": None,
            "organizations": [],
            "account_age_days": None,
            "account_age_years": None,
            "total_stars_received": None,
        },
        "contributions": {
            "most_active_since": None,
            "last_12_months": {
                "total": None,
                "commits": None,
                "pull_requests": None,
                "issues": None,
                "reviews": None,
                "calendar": [],
                "streaks": {"current": None, "longest": None},
                "daily_trend": [],
                "weekly_trend": [],
                "monthly_trend": [],
            },
            "year_over_year": [],
        },
        "repositories": {
            "tracked": [],
            "language_distribution": [],
            "recent_releases": [],
            "dependents_total": None,
        },
        "activity": {
            "commits": [],
            "pull_requests": [],
            "issues": [],
            "summary": {},
        },
        "totals": {
            "stars": None,
            "dependent_projects": None,
            "contributions": None,
            "followers": None,
        },
    }


def safe(label: str, fn, fallback):
    try:
        return fn(), True
    except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError, KeyError) as exc:
        print(f"[warn] {label}: {exc}", file=sys.stderr)
        return fallback, False


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    now = dt.datetime.now(dt.timezone.utc)

    existing = load_existing()
    payload = make_default_payload()

    payload["last_updated"] = isoformat_z(now)

    profile_fallback = existing.get("profile") or payload["profile"]
    profile, _ = safe("profile", lambda: fetch_profile(token), profile_fallback)
    payload["profile"] = profile

    events_fallback = existing.get("activity") or payload["activity"]
    events_raw, events_ok = safe("events", lambda: fetch_recent_events(token), [])
    activity = events_fallback
    if events_ok:
        activity = extract_activity(events_raw)
    payload["activity"] = activity

    start_12m = now - dt.timedelta(days=365)
    contrib_fallback = (existing.get("contributions") or payload["contributions"])
    collection, collection_ok = safe(
        "contributions_last_12_months",
        lambda: fetch_period_contributions(token, start_12m, now),
        {},
    )

    repo_scores: dict[str, int] = {}
    contrib_section = contrib_fallback
    if collection_ok:
        calendar_days = []
        weeks = ((collection.get("contributionCalendar") or {}).get("weeks") or [])
        for week in weeks:
            for day in week.get("contributionDays") or []:
                calendar_days.append({
                    "date": day.get("date"),
                    "count": int(day.get("contributionCount") or 0),
                    "weekday": int(day.get("weekday") or 0),
                })

        current_streak, longest_streak = compute_streaks(calendar_days)
        repo_scores = extract_repo_scores(collection)

        yoy, yoy_ok = safe("year_over_year", lambda: fetch_year_over_year(token, now), [])
        most_active_since, since_ok = safe("most_active_since", lambda: fetch_core_active_since(token), None)

        contrib_section = {
            "most_active_since": most_active_since if since_ok else contrib_fallback.get("most_active_since"),
            "last_12_months": {
                "total": int(((collection.get("contributionCalendar") or {}).get("totalContributions")) or 0),
                "commits": int(collection.get("totalCommitContributions") or 0),
                "pull_requests": int(collection.get("totalPullRequestContributions") or 0),
                "issues": int(collection.get("totalIssueContributions") or 0),
                "reviews": int(collection.get("totalPullRequestReviewContributions") or 0),
                "calendar": calendar_days,
                "streaks": {
                    "current": current_streak,
                    "longest": longest_streak,
                },
                "daily_trend": build_daily_trend(calendar_days),
                "weekly_trend": build_weekly_trend(calendar_days),
                "monthly_trend": build_monthly_trend(calendar_days),
            },
            "year_over_year": yoy if yoy_ok else contrib_fallback.get("year_over_year", []),
        }
    payload["contributions"] = contrib_section

    contributed_fallback = []
    contributed_repos, stars_total = safe(
        "contributed_repositories",
        lambda: fetch_contributed_repos(token),
        (contributed_fallback, profile.get("total_stars_received") if isinstance(profile, dict) else 0),
    )[0]

    if isinstance(payload["profile"], dict):
        payload["profile"]["total_stars_received"] = int(stars_total or 0)

    candidates = set(CORE_REPOS)
    for repo_name in repo_scores.keys():
        candidates.add(repo_name)
    for repo in contributed_repos:
        name = repo.get("name_with_owner")
        if name:
            candidates.add(name)
    if isinstance(events_raw, list):
        for event in events_raw:
            repo_name = ((event.get("repo") or {}).get("name"))
            if repo_name:
                candidates.add(repo_name)

    stars_lookup = {repo.get("name_with_owner", "").lower(): int(repo.get("stars") or 0) for repo in contributed_repos}
    ordered_repos = sort_repositories(candidates, repo_scores, stars_lookup)

    existing_repo_map = {
        (repo.get("name_with_owner") or "").lower(): repo
        for repo in (existing.get("repositories") or {}).get("tracked", [])
        if repo.get("name_with_owner")
    }

    tracked = []
    for repo in ordered_repos[:TRACKED_REPO_LIMIT]:
        fallback_repo = existing_repo_map.get(repo.lower())
        snapshot, ok = safe(f"repo:{repo}", lambda r=repo: fetch_repo_snapshot(r, token), fallback_repo)
        if snapshot:
            snapshot["contribution_score"] = repo_scores.get(repo, 0)
            tracked.append(snapshot)

    language_distribution = aggregate_languages(tracked)
    recent_releases = flatten_releases(tracked)
    dependents_total = sum(int(repo.get("dependent_projects") or 0) for repo in tracked)

    payload["repositories"] = {
        "tracked": tracked,
        "language_distribution": language_distribution,
        "recent_releases": recent_releases,
        "dependents_total": dependents_total,
    }

    total_stars = sum(int(repo.get("stars") or 0) for repo in tracked)
    total_dependents = dependents_total
    total_contributions = ((payload.get("contributions") or {}).get("last_12_months") or {}).get("total")
    total_followers = (payload.get("profile") or {}).get("followers")

    payload["totals"] = {
        "stars": total_stars,
        "dependent_projects": total_dependents,
        "contributions": int(total_contributions) if isinstance(total_contributions, int) else None,
        "followers": int(total_followers) if isinstance(total_followers, int) else None,
    }

    payload["meta"]["core_repos"] = CORE_REPOS
    payload["meta"]["tracked_repo_count"] = len(tracked)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    print(f"Updated {OUTPUT_PATH}")
    print(f"Last updated: {payload['last_updated']}")
    print(f"Tracked repos: {len(tracked)}")
    print(f"Total stars (tracked repos): {payload['totals']['stars']}")
    print(f"Followers: {payload['totals']['followers']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
