/**
 * Tool actions — parse and execute client-side actions from AI responses.
 *
 * The model is instructed to include action markers at the end of responses:
 *   [LINK: url | label]   — Suggest opening a link
 *   [NAV: path | label]   — Suggest navigating to a site page
 *
 * This module parses those markers, strips them from the display text,
 * and provides action metadata for the UI to render as buttons.
 */

import type { ToolAction } from './types';

/**
 * Pattern matching action markers in AI responses.
 * Matches: [LINK: url | label] and [NAV: path | label]
 */
const ACTION_PATTERN = /\[(LINK|NAV):\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\s*\]/g;

/** Result of parsing an AI response for actions. */
export interface ParsedResponse {
  /** The response text with action markers removed. */
  text: string;
  /** Extracted actions to render as buttons. */
  actions: ToolAction[];
}

/**
 * Parse an AI response for action markers.
 * Returns the cleaned text and any extracted actions.
 */
export function parseActions(response: string): ParsedResponse {
  const actions: ToolAction[] = [];

  const text = response.replace(ACTION_PATTERN, (_, type: string, url: string, label?: string) => {
    const trimmedUrl = url.trim();
    const trimmedLabel = label?.trim() || trimmedUrl;

    actions.push({
      type: type === 'NAV' ? 'navigate' : 'open_link',
      label: trimmedLabel,
      url: trimmedUrl,
    });

    return ''; // Remove the marker from display text
  });

  return { text: text.trimEnd(), actions };
}

/**
 * Execute a tool action.
 * Navigation opens in the same tab; external links open in a new tab.
 */
export function executeAction(action: ToolAction): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * System prompt section that instructs the model how to use actions.
 * Appended to the system prompt at build time.
 */
export const TOOLS_PROMPT_SECTION = `
# Available Actions
When your answer references a specific link, page, or project, include action markers at the END of your response (after your text). Only include actions that are directly relevant.

Format:
[LINK: url | label]  — Suggest opening an external link
[NAV: path | label]  — Suggest navigating to a page on this site

Examples:
[LINK: https://github.com/celery/celery | View Celery on GitHub]
[LINK: https://www.linkedin.com/in/tomernosrati | Tomer's LinkedIn]
[NAV: / | Back to Portfolio]

Rules:
- Only include actions for URLs mentioned in your knowledge base
- Maximum 2 actions per response
- Always place actions at the very end, after your text
- Do not invent URLs — only use URLs from the provided data`;
