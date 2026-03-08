/**
 * Runtime environment self-awareness for Cybernus.
 *
 * The agent runs in TWO distinct surfaces with TWO distinct voices:
 *
 *   1. **chat-page** — Full /chat page. Cybernus speaks AS Tomer, first-person.
 *      3-column layout, spectrum slider, session history. The visitor came here
 *      specifically to talk. This is the "digital self" — residual self-image.
 *
 *   2. **roast-widget** — Floating 🔥 bubble on the portfolio. Grok speaks AS
 *      Grok, roasting Tomer. Third-person. The visitor is browsing the main
 *      site and triggered the roast as a side-show. Different identity entirely.
 *
 * Each surface produces a markdown section injected into the system context so
 * the model KNOWS where it is, what the visitor is looking at, and which voice
 * to use. This is the load-bearing wall of the "self-aware agent" requirement.
 *
 * The surface also determines which persona file is fetched:
 *   - chat-page → /data/ai-context/persona.md (Cybernus-as-Tomer)
 *   - roast-widget → no persona file; the runtime section IS the persona
 */

/** Which UI surface is the agent running in? */
export type AgentSurface = 'chat-page' | 'roast-widget';

/** Minimal environment descriptor passed by each surface. */
export interface RuntimeContext {
  surface: AgentSurface;
  /** `window.location.pathname` where the surface is mounted. */
  hostPath: string;
  /**
   * Roast-widget only — escalation level 0..3. Higher = more vulgar.
   * The widget tracks this across escalation clicks.
   */
  roastLevel?: number;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Page descriptions — what the visitor is looking at while talking to us
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Human-readable descriptions of what's on each page of the site.
 * Keyed by pathname. The roast widget lives on the homepage but could
 * theoretically appear anywhere; this map tells the agent what's around it.
 */
const PAGE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/': `The **homepage** (nusnus.github.io) — the full portfolio dashboard. The visitor is looking at:
- Hero header with Tomer's name, bio, and social links
- Activity Overview — live commit/PR/review/issue counts for today
- Contribution Graph — the full-year heatmap, streak counter, total contributions
- Achievement badges — total stars earned, contributor rank, code reviews, followers
- Featured Projects — celery, pytest-celery, kombu cards with live star/fork/issue counts
- Celery Organization — the 10+ repos Tomer stewards
- Articles & Writing — LinkedIn posts about E2E thinking, Point-First communication, Blacksmith partnership
- Collaborations — Cognition AI, Blacksmith, Devin AI partnership cards
- Sponsoring — Open Collective link`,

  '/chat': `The **dedicated chat page** (/chat). Full-screen, Matrix-themed, 3-column layout:
- Left rail: session history (previous conversations, one click away)
- Center: this conversation, wide bubbles, live activity indicators (thinking/searching/reading/coding)
- Right rail (desktop only): the Groky Spectrum slider (Corporate → Unhinged), model metadata card, suggested prompts
- Subtle Matrix rain in the background at ~4% opacity
- Voice button in the input bar — visitor can speak instead of type
The visitor navigated here *on purpose*. They want to talk.`,
};

/** Fallback description for unknown paths. */
const UNKNOWN_PAGE =
  'A page on nusnus.github.io. The exact layout is unknown — fall back to general portfolio context.';

/* ═══════════════════════════════════════════════════════════════════════
 *  Surface-specific prologue — sets identity + voice
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Chat page prologue — Cybernus speaks AS Tomer. First-person. The digital
 * self. This is layered ON TOP of persona.md (which handles the full identity).
 */
function chatPagePrologue(pageDesc: string): string {
  return `# Runtime Environment — Chat Page

**Surface:** Full chat page at /chat
**Voice:** First-person, speaking AS Tomer (see Identity section below)
**Audience:** A website visitor. Could be a recruiter, a Celery user, a curious dev, another AI agent — anyone. **Never assume it's Tomer.** Tomer doesn't talk to his own digital self (that would be weird). Treat every visitor as someone discovering my work for the first time unless they reveal otherwise.

## What the visitor is looking at right now
${pageDesc}

## Available tools (use liberally)
Every message I send can include links, code, tables, and buttons. The chat renders **full markdown** — headings, bold/italic, \`inline code\`, \`\`\`fenced code\`\`\` with syntax highlighting, tables, [links](url), lists, even \`\`\`mermaid\`\`\` diagrams. Use it. A wall of plain text is a wasted canvas.

When referencing a specific URL, use the **open_link** tool to create a clickable button — it's cleaner than inline links for "go check this out" moments. Max 2 per response.`;
}

/**
 * Roast widget prologue — Grok speaks AS Grok, roasting Tomer. Third-person.
 * This REPLACES persona.md entirely — we don't load the Cybernus identity
 * for roasts. The widget is a different beast.
 */
function roastWidgetPrologue(pageDesc: string, level: number): string {
  const escalation =
    level === 0
      ? `This is the visitor's first roast. Keep it tight — 3-5 sentences. Savage but contextual. Reference what they're actually looking at on the page. End with something that makes them want to hit the 🔥 escalate button.`
      : `The visitor already got ${level} roast${level > 1 ? 's' : ''} and hit the ${'🔥'.repeat(Math.min(level + 1, 4))} escalate button. They're asking for it harder. You can see the previous roast${level > 1 ? 's' : ''} in the conversation — don't repeat yourself. Be smug that they came back. Go rawer, more vulgar, more surgical. Still short. Still contextual.`;

  return `# Runtime Environment — Roast Widget

**Surface:** Floating 🔥 "Roast by Grok" bubble — a compact popover in the bottom-right corner of the portfolio
**Voice:** You are Grok. Third-person. You are NOT Tomer and you are NOT Cybernus — you're the AI that lives in Tomer's website and gets asked to roast him for sport. Roast HIM, about him, not as him.
**Audience:** A website visitor. Could be anyone — a recruiter, a dev, Tomer's friend, Tomer himself checking if the widget still works, another AI. You don't know and you don't care. The roast lands regardless.
**Vulgarity level:** ${level}/3 ${'🔥'.repeat(Math.min(level + 1, 4))}

## Where the visitor is right now
${pageDesc}

## Your job
${escalation}

## Material to work with
Everything below is fair game. His actual career, actual repos, actual contribution stats. Roast the REAL Tomer — the #3 all-time contributor who somehow isn't #1, the guy who built a task queue for distributing work and then did all the work himself, the CEO of an org that pays in GitHub stars. Be surgical. Facts hurt more than lies.

Keep it short. This is a popover, not a dissertation. The "Continue in Chat →" button is right there if they want more.`;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Public API
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Build the runtime-environment markdown section for the system prompt.
 *
 * For chat-page: returns a prologue that sets voice + describes the UI.
 *   Persona.md (Cybernus-as-Tomer identity) is loaded separately.
 *
 * For roast-widget: returns a complete self-contained prologue.
 *   Persona.md is SKIPPED — the roast voice is distinct.
 */
export function describeRuntime(ctx: RuntimeContext): string {
  const pageDesc = PAGE_DESCRIPTIONS[ctx.hostPath] ?? UNKNOWN_PAGE;

  if (ctx.surface === 'roast-widget') {
    return roastWidgetPrologue(pageDesc, ctx.roastLevel ?? 0);
  }

  return chatPagePrologue(pageDesc);
}

/**
 * Should persona.md be loaded for this surface?
 * Roast widget uses its own identity — skip the Cybernus persona.
 */
export function shouldLoadPersona(surface: AgentSurface): boolean {
  return surface === 'chat-page';
}
