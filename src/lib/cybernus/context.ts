/**
 * Cybernus context builder.
 *
 * Wraps the base `buildCloudContext()` (persona + knowledge + site data)
 * and layers two extra blocks on top:
 *
 *   1. `## Runtime Environment` — which page, which surface, which viewport.
 *      The persona promises this block exists; this file delivers it.
 *
 *   2. `## Current Spectrum Setting` — the Groky slider position.
 *
 * Both blocks are appended AFTER the base context so that if the prompt
 * ever hits token limits, the persona and knowledge survive the truncation.
 */

import { buildCloudContext } from '@lib/ai/cloud-context';
import { buildSpectrumPrompt } from './spectrum';

/** Supported UI languages. Passed to the model so it picks the right default. */
export type CybernusLanguage = 'en' | 'es';

/** Viewport class — coarse, we don't need pixel precision in the prompt. */
export type CybernusViewport = 'desktop' | 'mobile';

/** Which surface mounted the chat component. */
export type CybernusSurface = 'chat-page' | 'roast-widget';

/** Parameters for `buildCybernusContext`. */
export interface CybernusContextParams {
  /** Current Groky Spectrum position (0-100). */
  spectrum: number;
  /** Page pathname where the chat is mounted (e.g. "/chat"). */
  pathname: string;
  /** Viewport class. */
  viewport: CybernusViewport;
  /** Surface that rendered this conversation. */
  surface: CybernusSurface;
  /** User's preferred UI language. The model auto-detects from input anyway, but this sets the default. */
  language: CybernusLanguage;
}

/** Build the `## Runtime Environment` block. */
function buildRuntimeEnvironment(p: CybernusContextParams): string {
  const surfaceDesc =
    p.surface === 'chat-page'
      ? 'Full-screen Cybernus chat page. Wide layout, personality slider visible, session history sidebar available.'
      : 'Roast Widget (homepage FAB). Compact overlay — keep it punchy.';

  const viewportDesc =
    p.viewport === 'desktop'
      ? 'Desktop — you have horizontal room for tables, wide code blocks, and Mermaid diagrams.'
      : 'Mobile — keep tables narrow, prefer lists, avoid wide code.';

  const langDesc =
    p.language === 'es'
      ? 'Spanish (Cali, Colombia style — warm, casual, "parce" welcome).'
      : 'English.';

  return [
    '## Runtime Environment',
    '',
    `- **Page:** \`${p.pathname}\``,
    `- **Surface:** ${surfaceDesc}`,
    `- **Viewport:** ${viewportDesc}`,
    `- **UI language:** ${langDesc}`,
  ].join('\n');
}

/**
 * Build the full Cybernus system context.
 *
 * Async because `buildCloudContext()` fetches persona/knowledge/data
 * from `/data/ai-context/*.md` and `/data/*.json` at runtime.
 */
export async function buildCybernusContext(params: CybernusContextParams): Promise<string> {
  const base = await buildCloudContext();
  const runtime = buildRuntimeEnvironment(params);
  const spectrum = buildSpectrumPrompt(params.spectrum);

  // Blank-line-separated — easy to eyeball in the worker logs.
  return `${base}\n\n---\n\n${runtime}\n\n---\n\n${spectrum}`;
}
