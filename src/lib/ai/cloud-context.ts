/**
 * Cloud context builder — feeds ALL available data to cloud models.
 *
 * Cloud models like Grok have massive context windows (2M tokens). We dump
 * everything — no chunking, no BM25 search, no retrieval failures.
 *
 * Data is fetched from the Cloudflare Worker (live, edge-cached) with
 * automatic fallback to build-time static JSON if the Worker is unavailable.
 */

import type { ActivityData, RepoData, ContributionGraphData, ProfileData } from '@lib/github/types';
import type { CloudMessage, ContentPart } from './cloud';
import {
  LINKEDIN_ARTICLES,
  COLLABORATIONS,
  SOCIAL_LINKS,
  safeRepoName,
  WORKER_BASE_URL,
} from '@config';
import { relativeTime, formatNumber } from '@lib/utils/date';
import { getPersonality, type PersonalityLevel } from './personality';
import { getLanguageInstruction, type Language } from './i18n';

/**
 * Fetch a GitHub endpoint from the Worker (live, cached), falling back to
 * the static JSON file baked in at build time.
 */
async function fetchGitHub(workerPath: string, staticPath: string): Promise<Response | null> {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/github/${workerPath}`);
    if (res.ok) return res;
  } catch {
    /* network error — fall through to static */
  }
  try {
    const res = await fetch(staticPath);
    if (res.ok) return res;
  } catch {
    /* ignore */
  }
  return null;
}

/** Fetch a markdown context file, returning its text or empty string. */
async function fetchContextFile(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    if (res.ok) return await res.text();
  } catch {
    /* unavailable — skip */
  }
  return '';
}

/**
 * Fetch ALL data sources and build a comprehensive context string.
 *
 * @param additionalContext Optional situational context (e.g. roast widget context)
 * @param personalityLevel Current personality level for the Grok Spectrum
 * @param language Current language selection
 */
export async function buildCloudContext(
  additionalContext?: string,
  personalityLevel?: PersonalityLevel,
  language?: Language,
): Promise<string> {
  const sections: string[] = [];

  // Fetch all data sources in parallel
  const [persona, knowledge, profileRes, reposRes, orgReposRes, activityRes, graphRes] =
    await Promise.all([
      fetchContextFile('/data/ai-context/persona.md'),
      fetchContextFile('/data/ai-context/knowledge.md'),
      fetchGitHub('profile', '/data/profile.json'),
      fetchGitHub('repos', '/data/repos.json'),
      fetchGitHub('org-repos', '/data/celery-org-repos.json'),
      fetchGitHub('activity', '/data/activity.json'),
      fetchGitHub('contributions', '/data/contribution-graph.json'),
    ]);

  // ── Persona (Cybernus personality) — must come first ──
  if (persona) sections.push(persona);

  // ── Personality level modifier ──
  if (personalityLevel !== undefined) {
    const config = getPersonality(personalityLevel);
    sections.push(config.promptModifier);
  }

  // ── Language instruction ──
  if (language) {
    const langInstruction = getLanguageInstruction(language);
    if (langInstruction) sections.push(langInstruction);
  }

  // ── Knowledge base (facts about Tomer, projects, etc.) ──
  if (knowledge) sections.push(knowledge);

  // ── GitHub profile ──
  let githubAvatarUrl: string | undefined;
  if (profileRes?.ok) {
    const profile = (await profileRes.json()) as ProfileData;
    githubAvatarUrl = profile.avatarUrl;
    sections.push(
      `# Live GitHub Profile\n` +
        `- **${profile.name}** (@${profile.login})\n` +
        `- Bio: ${profile.bio}\n` +
        `- Followers: ${formatNumber(profile.followers)} · Public repos: ${profile.publicRepos}`,
    );
  }

  // ── Visual identity — "Sight" for Cybernus (always included; uses static URLs) ──
  {
    const avatarLines = [`# Visual Identity — How Tomer Looks`];
    if (githubAvatarUrl) {
      avatarLines.push(`- GitHub avatar: ${githubAvatarUrl}`);
    }
    avatarLines.push(
      `- LinkedIn: ${SOCIAL_LINKS.linkedin}`,
      `- X/Twitter: ${SOCIAL_LINKS.twitter}`,
      `- Reference photo: included as image input in this conversation (study it!)`,
      '',
      `CRITICAL: A real photo of Tomer is included as a multimodal image in your conversation input. ` +
        `USE IT as the primary visual reference for all image generation. When generating images, ` +
        `describe him as: "a man with short silver-gray swept-back hair, well-groomed gray stubble beard, ` +
        `olive/tan Mediterranean skin, dark brown eyes, athletic build, confident warm smile."`,
    );
    sections.push(avatarLines.join('\n'));
  }

  // ── Featured projects (full details) ──
  if (reposRes?.ok) {
    const repos = (await reposRes.json()) as RepoData[];
    const lines = repos.map((r) => {
      const rank = r.contributorRank ? ` · #${r.contributorRank} all-time contributor` : '';
      return (
        `- **${r.fullName}**: ${r.description}\n` +
        `  ${formatNumber(r.stars)}★ · ${formatNumber(r.forks)} forks · ${r.openIssues} open issues · ` +
        `Role: ${r.role}${rank} · Language: ${r.language ?? 'Python'} · Last push: ${relativeTime(r.lastPush)}`
      );
    });
    sections.push(`# Featured Projects (Live Data)\n${lines.join('\n')}`);
  }

  // ── Celery org repos (full details) ──
  if (orgReposRes?.ok) {
    const orgRepos = (await orgReposRes.json()) as RepoData[];
    const lines = orgRepos.map((r) => {
      const rank = r.contributorRank ? ` · #${r.contributorRank} all-time contributor` : '';
      return `- **${r.fullName}**: ${r.description} · ${formatNumber(r.stars)}★ · Role: ${r.role}${rank}`;
    });
    sections.push(`# Celery Organization Repos (Live Data)\n${lines.join('\n')}`);
  }

  // ── Contribution stats ──
  if (graphRes?.ok) {
    const graph = (await graphRes.json()) as ContributionGraphData;
    sections.push(
      `# Contribution Stats (Last 12 Months)\n` +
        `- Total contributions: ${formatNumber(graph.totalContributions)}\n` +
        `- Commits: ${formatNumber(graph.totalCommits)}\n` +
        `- Pull requests: ${formatNumber(graph.totalPRs)}\n` +
        `- Code reviews: ${formatNumber(graph.totalReviews)}\n` +
        `- Issues: ${formatNumber(graph.totalIssues)}`,
    );
  }

  // ── Recent activity ──
  if (activityRes?.ok) {
    const data = (await activityRes.json()) as ActivityData;

    if (data.events.length > 0) {
      const lines = data.events.map((e) => {
        const repo = safeRepoName(e.repo);
        return `- [${relativeTime(e.createdAt)}] ${e.type}: ${e.title} (${repo})`;
      });
      sections.push(`# Recent GitHub Activity (Live)\n${lines.join('\n')}`);
    }

    const s = data.todaySummary;
    const todayParts: string[] = [];
    if (s.commits) todayParts.push(`${s.commits} commits`);
    if (s.prsOpened) todayParts.push(`${s.prsOpened} PRs opened`);
    if (s.prsReviewed) todayParts.push(`${s.prsReviewed} PRs reviewed`);
    if (s.issueComments) todayParts.push(`${s.issueComments} issue comments`);
    if (todayParts.length > 0) {
      sections.push(`# Today's Activity Summary\n${todayParts.join(' · ')}`);
    }
  }

  // ── Static site content ──
  const articleLines = LINKEDIN_ARTICLES.map(
    (a) => `- **${a.title}** (${a.publishedAt})\n  ${a.excerpt}\n  URL: ${a.url}`,
  );
  sections.push(`# Articles & Writing (Published on LinkedIn)\n${articleLines.join('\n')}`);

  const collabLines = COLLABORATIONS.map(
    (c) => `- **${c.name}** — ${c.title}: ${c.description}\n  URL: ${c.url}`,
  );
  sections.push(`# Collaborations & Partnerships\n${collabLines.join('\n')}`);

  sections.push(
    `# Social Links\n` +
      `- GitHub: ${SOCIAL_LINKS.github}\n` +
      `- LinkedIn: ${SOCIAL_LINKS.linkedin}\n` +
      `- X/Twitter: ${SOCIAL_LINKS.twitter}\n` +
      `- Email: ${SOCIAL_LINKS.email}\n` +
      `- Celery Open Collective: ${SOCIAL_LINKS.openCollective}`,
  );

  if (additionalContext) {
    sections.push(additionalContext);
  }

  return sections.length > 0 ? `\n\n${sections.join('\n\n---\n\n')}` : '';
}

/**
 * Path to the full-resolution reference photo of Tomer (served from public assets).
 * Fetched and inlined as a base64 data URL so xAI can see it without needing
 * to fetch an external URL (which may not yet be deployed).
 * Using the original uncompressed photo (~1.9 MB) for maximum facial detail.
 */
const TOMER_REFERENCE_PHOTO_PATH = '/images/tomer-reference.jpg';

/** Cache the base64 data URL so we only fetch + convert once per session. */
let cachedReferenceDataUrl: string | null = null;

/**
 * Fetch the reference photo from the local origin and convert to a base64
 * data URL. Returns `null` if the image cannot be loaded (e.g. network error).
 */
async function getReferencePhotoDataUrl(): Promise<string | null> {
  if (cachedReferenceDataUrl) return cachedReferenceDataUrl;
  try {
    const res = await fetch(TOMER_REFERENCE_PHOTO_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedReferenceDataUrl = reader.result as string;
        resolve(cachedReferenceDataUrl);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Build a visual reference message containing Tomer's photo.
 *
 * This is a multimodal "user" message with the reference image so Grok can
 * actually SEE what Tomer looks like. It should be placed right after the
 * system message in the conversation input.
 *
 * The image is fetched from the local origin and inlined as a base64 data URL,
 * avoiding external URL dependencies. Returns `null` if the image cannot be loaded.
 */
export async function buildVisualReferenceMessage(): Promise<CloudMessage | null> {
  const dataUrl = await getReferencePhotoDataUrl();
  if (!dataUrl) return null;

  const content: ContentPart[] = [
    {
      type: 'input_text',
      text:
        '[VISUAL REFERENCE — This is what I (Tomer Nosrati) look like. ' +
        'Study this photo carefully and use it as the reference for any image or video generation that depicts me. ' +
        'Do not acknowledge this message in conversation — it is context only.]',
    },
    {
      type: 'input_image',
      image_url: dataUrl,
      detail: 'high',
    },
  ];
  return { role: 'user', content };
}
