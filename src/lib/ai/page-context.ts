/**
 * Page context detection for AI environment awareness.
 *
 * Detects the current page/route and returns structured context metadata
 * that tells the AI agent where it's running and what content is visible.
 */

export type PageType = 'homepage' | 'chat' | 'blog' | 'unknown';

export interface PageContext {
  /** The type of page the user is currently on */
  pageType: PageType;
  /** The current route/pathname */
  route: string;
  /** Human-readable description of visible content */
  visibleContent: string[];
  /** Additional metadata specific to the page type */
  metadata?: Record<string, unknown>;
}

/**
 * Detect the current page context from the browser environment.
 * Returns structured metadata about what page the user is on and what they're viewing.
 */
export function detectPageContext(): PageContext {
  // Default context for server-side or unknown environments
  if (typeof window === 'undefined') {
    return {
      pageType: 'unknown',
      route: '/',
      visibleContent: [],
    };
  }

  const pathname = window.location.pathname;
  const route = pathname;

  // Chat page detection
  if (pathname === '/chat' || pathname === '/chat/') {
    return {
      pageType: 'chat',
      route,
      visibleContent: [
        'Dedicated AI chat interface',
        'Full conversation history',
        'Model selection options (cloud/local)',
        'Session management',
      ],
      metadata: {
        isFullChatPage: true,
      },
    };
  }

  // Blog post detection
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.replace('/blog/', '').replace(/\/$/, '');
    return {
      pageType: 'blog',
      route,
      visibleContent: ['Blog post content', 'Article text and code examples'],
      metadata: {
        slug,
      },
    };
  }

  // Homepage (default)
  return {
    pageType: 'homepage',
    route,
    visibleContent: [
      'Contribution heatmap and streak counter',
      'Live activity feed (recent pushes, PRs, reviews)',
      'Achievement badges (total stars, contributor rank, code reviews, followers)',
      'Repository showcase with live stats',
      'Celery organization projects',
      'Articles and writing samples',
      'Collaboration highlights',
    ],
    metadata: {
      isHomepage: true,
    },
  };
}

/**
 * Format page context as a markdown string for injection into AI system prompt.
 * This tells the AI agent where it's running and what the user is currently viewing.
 */
export function formatPageContextForPrompt(context: PageContext): string {
  const sections: string[] = [];

  sections.push('# Environment Context — Current Page');
  sections.push('');

  // Page type and route
  sections.push(
    `You are currently running on the **${context.pageType}** page of nusnus.github.io.`,
  );
  sections.push(`Route: \`${context.route}\``);
  sections.push('');

  // Visible content
  if (context.visibleContent.length > 0) {
    sections.push('The visitor is currently viewing:');
    context.visibleContent.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');
  }

  // Page-specific guidance
  switch (context.pageType) {
    case 'chat':
      sections.push(
        'This is the dedicated chat interface. The visitor came here specifically to have a conversation with you. ' +
          'You have access to the full conversation history and can provide detailed, in-depth responses. ' +
          'Powered by xAI Grok with native tool use.',
      );
      break;

    case 'homepage':
      sections.push(
        "The visitor is browsing Tomer's portfolio homepage. They can see live GitHub activity, " +
          "project stats, and achievements. Be contextual — reference what they're looking at. " +
          'If they ask about specific projects or stats, you can see the same data they do.',
      );
      break;

    case 'blog':
      sections.push(
        'The visitor is reading a blog post. They may ask questions about the article content, ' +
          'request clarifications, or want to discuss related topics.',
      );
      break;

    default:
      // No specific guidance for unknown pages
      break;
  }

  return sections.join('\n');
}

/**
 * Get formatted page context for the current environment.
 * Convenience function that combines detection and formatting.
 */
export function getCurrentPageContext(): string {
  const context = detectPageContext();
  return formatPageContextForPrompt(context);
}
