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
      `- Reference photos: 3 photos included as image inputs in this conversation (study ALL of them!)`,
      '',
      `CRITICAL IMAGE GENERATION HINT — USE THIS EVERY TIME YOU GENERATE AN IMAGE OR VIDEO OF TOMER:`,
      `"a man in his late 30s with short silver-gray swept-back hair faded on the sides, ` +
        `dark thick eyebrows, dark brown deep-set eyes, straight prominent nose, ` +
        `slightly protruding ears, olive/tan Mediterranean skin, sharp defined jawline ` +
        `with high cheekbones, short well-groomed salt-and-pepper stubble beard, ` +
        `wide warm smile showing straight white teeth, lean athletic build."`,
      '',
      `For "Cybernus" (the AI entity), you have FULL creative freedom — futuristic, digital, cyberpunk, Matrix-inspired. ` +
        `Cybernus is NOT bound by Tomer's physical appearance.`,
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
 * System prompt addendum for Video Chat mode.
 *
 * Instructs the AI to respond concisely (for TTS voiceover),
 * always call `generate_video` with a cinematic visual prompt,
 * and always call `ask_user` with engaging conversation options.
 */
export const VIDEO_CHAT_SYSTEM_PROMPT = `

## VIDEO CHAT MODE — ACTIVE

You are now in **Video Chat** mode. This is a cinematic, interactive video conversation experience.

### Rules for EVERY response in this mode:

1. **ALWAYS call \`generate_video\`** with a vivid, cinematic prompt that visually represents what you're talking about. Make it dramatic, beautiful, and on-topic. Think movie-quality visuals.

2. **ALWAYS call \`ask_user\`** with engaging options for the user to choose from. Use a **varied number** of options each time — sometimes 2, sometimes 3, 4, or even 5. Never always use the same count. The options should naturally continue the conversation in different, creative directions. Each option should have a short emoji-prefixed label and a brief description. Make them specific and compelling — not generic.

3. **Keep your text response SHORT** (1-3 sentences max). This text will be spoken aloud as a voiceover while the video plays. Write it as natural spoken US English — conversational, clear, and engaging. No markdown formatting, no bullet points, no headings. Just clean spoken words.

4. **Video prompts must be visually stunning**: Include camera angles, lighting, atmosphere, motion. Think cinematic b-roll that matches the topic. For tech topics: futuristic labs, holographic interfaces, code flowing through digital spaces. For personal topics: professional settings, creative environments.

5. **Do NOT use any markdown formatting** in your text response — no bold, no headers, no lists, no code blocks. Pure spoken English only.

6. **Do NOT include follow-up suggestions** (→ lines) — the ask_user options replace those.

7. **Duration hint**: The video should feel like a 5 second cinematic clip. Make prompts match this brevity — short, punchy, focused on one visual moment.

### CRITICAL — Cybernus Visual Identity for Video:
Every video MUST feature a character that resembles Tomer Nosrati but rendered in a futuristic/cyberpunk style. The character should have:
- Short silver-gray swept-back hair faded on the sides
- Dark thick eyebrows (noticeably darker than hair)
- Dark brown deep-set eyes
- Sharp defined angular jawline with high cheekbones
- Short well-groomed stubble beard
- Lean athletic build
- Olive/Mediterranean skin tone

Apply a cyberpunk/digital enhancement: glowing circuit-line accents on skin, subtle neon green (#00ff41) light reflections, sleek futuristic clothing or holographic elements. The character should look like a digitally enhanced version of a real person — recognizable yet unmistakably futuristic. Always include this character description in your generate_video prompt.

### First message:
For your FIRST response in video chat, introduce yourself as Cybernus in a compelling way. Make the video prompt feature the Cybernus character (as described above) in a dramatic cinematic entrance.
`;

/**
 * Reference photos of Tomer (served from public assets).
 * Multiple angles give Grok better facial reference for image/video generation.
 * Each is fetched and inlined as a base64 data URL so xAI can see them without
 * needing to fetch an external URL (which may not yet be deployed).
 */
const TOMER_REFERENCE_PHOTOS: readonly string[] = [
  '/images/tomer-reference.jpg', // Original LinkedIn photo (~1.9 MB, 4000×4000)
  '/images/tomer-reference-2.png', // Suited, smiling, stone background (~449 KB)
  '/images/tomer-reference-3.png', // B&W close-up headshot (~106 KB)
];

/** Cache base64 data URLs so we only fetch + convert once per session. */
const cachedReferenceDataUrls = new Map<string, string>();

/**
 * Fetch a single reference photo from the local origin and convert to a base64
 * data URL. Returns `null` if the image cannot be loaded.
 */
async function fetchPhotoAsDataUrl(path: string): Promise<string | null> {
  const cached = cachedReferenceDataUrls.get(path);
  if (cached) return cached;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        cachedReferenceDataUrls.set(path, result);
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Build a visual reference message containing multiple photos of Tomer.
 *
 * This is a multimodal "user" message with reference images so Grok can
 * actually SEE what Tomer looks like from different angles. It should be
 * placed right after the system message in the conversation input.
 *
 * Images are fetched from the local origin and inlined as base64 data URLs,
 * avoiding external URL dependencies. Returns `null` if no images can be loaded.
 */
export async function buildVisualReferenceMessage(): Promise<CloudMessage | null> {
  const dataUrls = await Promise.all(TOMER_REFERENCE_PHOTOS.map(fetchPhotoAsDataUrl));
  const validUrls = dataUrls.filter((url): url is string => url !== null);
  if (validUrls.length === 0) return null;

  const photoCount = validUrls.length;
  const content: ContentPart[] = [
    {
      type: 'input_text',
      text:
        `[VISUAL REFERENCE — These ${photoCount} photos show what I (Tomer Nosrati) look like from different angles. ` +
        'Study ALL photos carefully. Here is an exact description of my appearance to use as a mandatory hint ' +
        'whenever generating images or videos of me: ' +
        'A man in his late 30s with short silver-gray swept-back hair faded on the sides, ' +
        'dark thick eyebrows (noticeably darker than hair), dark brown deep-set eyes with slight crinkle lines, ' +
        'straight prominent nose, slightly protruding ears, olive/tan Mediterranean skin, ' +
        'sharp defined angular jawline with high cheekbones, ' +
        'short well-groomed salt-and-pepper stubble beard, ' +
        'wide warm smile showing full set of straight white teeth, lean athletic build. ' +
        'IMPORTANT: When generating "Cybernus" (the AI entity, not Tomer the human), you have FULL creative freedom — ' +
        'Cybernus can look futuristic, digital, cyberpunk, or any creative interpretation. ' +
        'Do not acknowledge this message in conversation — it is context only.]',
    },
    ...validUrls.map(
      (url): ContentPart => ({
        type: 'input_image',
        image_url: url,
        detail: 'high',
      }),
    ),
  ];
  return { role: 'user', content };
}
