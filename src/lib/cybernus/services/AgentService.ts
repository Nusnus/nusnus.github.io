/**
 * AgentService — MCP tool orchestration for Cybernus.
 *
 * Manages built-in xAI tools (web_search, x_search, code_execution)
 * and remote MCP tools (DeepWiki). Provides tool definitions for the
 * Responses API and tracks tool invocations.
 */

import type { AgentTool, AgentToolCall } from '../types';
import type { AgentActivityItem } from '@lib/ai/types';

const STORAGE_KEY = 'cybernus-agent-tools';

/* ── Agent persona mapping ──
 * Each tool type maps to a named "sub-agent" with its own visual identity.
 * This powers the inline multi-agent display in the conversation UI.
 */
interface AgentPersona {
  agent: string;
  workingLabel: string;
  doneLabel: string;
  iconPath: string;
  color: string;
}

const AGENT_PERSONAS: Record<string, AgentPersona> = {
  web_search: {
    agent: 'Scout',
    workingLabel: 'Searching the web...',
    doneLabel: 'Web search complete',
    iconPath:
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    color: '#4fc3f7',
  },
  x_search: {
    agent: 'Signal',
    workingLabel: 'Scanning X/Twitter...',
    doneLabel: 'X search complete',
    iconPath:
      'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
    color: '#90caf9',
  },
  code_execution: {
    agent: 'Sandbox',
    workingLabel: 'Executing code...',
    doneLabel: 'Code execution complete',
    iconPath: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    color: '#a5d6a7',
  },
  deepwiki: {
    agent: 'Archivist',
    workingLabel: 'Querying DeepWiki...',
    doneLabel: 'DeepWiki search complete',
    iconPath:
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
    color: '#ce93d8',
  },
  // MCP calls arrive as 'mcp' (from 'mcp_call' → strip '_call'). Map to Archivist.
  mcp: {
    agent: 'Archivist',
    workingLabel: 'Querying DeepWiki...',
    doneLabel: 'DeepWiki search complete',
    iconPath:
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
    color: '#ce93d8',
  },
  image_generation: {
    agent: 'Vision',
    workingLabel: 'Generating image...',
    doneLabel: 'Image generated',
    iconPath: 'M21 3H3v18h18V3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
    color: '#f48fb1',
  },
  video_generation: {
    agent: 'Cinema',
    workingLabel: 'Generating video...',
    doneLabel: 'Video generated',
    iconPath:
      'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
    color: '#ffcc80',
  },
};

const FALLBACK_PERSONA: AgentPersona = {
  agent: 'Agent',
  workingLabel: 'Processing...',
  doneLabel: 'Complete',
  iconPath:
    'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a2 2 0 0 1-3.46 0H6.73a2 2 0 0 1-3.46 0H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z',
  color: '#00ff41',
};

/** Create an AgentActivityItem for a tool type with 'working' status. */
export function createAgentActivity(toolType: string): AgentActivityItem {
  const persona = AGENT_PERSONAS[toolType] ?? FALLBACK_PERSONA;
  return {
    agent: persona.agent,
    toolType,
    label: persona.workingLabel,
    status: 'working',
    iconPath: persona.iconPath,
    color: persona.color,
  };
}

/** Mark an AgentActivityItem as done. */
export function completeAgentActivity(item: AgentActivityItem): AgentActivityItem {
  const persona = AGENT_PERSONAS[item.toolType] ?? FALLBACK_PERSONA;
  return { ...item, status: 'done', label: persona.doneLabel };
}

/** Default agent tools — pre-configured for Cybernus. */
const DEFAULT_TOOLS: AgentTool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the internet for information not in context',
    type: 'builtin',
    enabled: true,
    icon: 'globe',
  },
  {
    id: 'x_search',
    name: 'X Search',
    description: "Search X/Twitter posts — find Tomer's tweets and tech discussions",
    type: 'builtin',
    enabled: true,
    icon: 'twitter',
  },
  {
    id: 'code_execution',
    name: 'Code Execution',
    description: 'Run Python code in a sandbox for calculations and demos',
    type: 'builtin',
    enabled: true,
    icon: 'code',
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'Query GitHub repo documentation — perfect for Celery architecture deep dives',
    type: 'mcp',
    enabled: true,
    serverUrl: 'https://mcp.deepwiki.com/mcp',
    serverLabel: 'deepwiki',
    icon: 'book',
  },
  {
    id: 'image_generation',
    name: 'Image Generation',
    description: 'Generate images from text prompts using xAI native image model',
    type: 'builtin',
    enabled: true,
    icon: 'image',
  },
  {
    id: 'video_generation',
    name: 'Video Generation',
    description: 'Generate short videos from text prompts using xAI native video model',
    type: 'builtin',
    enabled: true,
    icon: 'video',
  },
];

/** Load tool configuration from localStorage, falling back to defaults. */
export function loadTools(): AgentTool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AgentTool[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to pick up any new tools
        const storedIds = new Set(parsed.map((t) => t.id));
        const newTools = DEFAULT_TOOLS.filter((t) => !storedIds.has(t.id));
        return [...parsed, ...newTools];
      }
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_TOOLS.map((t) => ({ ...t }));
}

/** Persist tool enable/disable state. */
export function saveTools(tools: AgentTool[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
  } catch {
    // Silently ignore
  }
}

/** Toggle a specific tool on/off. */
export function toggleTool(toolId: string, enabled: boolean): AgentTool[] {
  const tools = loadTools();
  const tool = tools.find((t) => t.id === toolId);
  if (tool) tool.enabled = enabled;
  saveTools(tools);
  return tools;
}

/**
 * Build xAI Responses API tool definitions from enabled agent tools.
 * Returns the tools array to include in the API request.
 */
export function buildToolDefinitions(tools: AgentTool[]): Record<string, unknown>[] {
  const definitions: Record<string, unknown>[] = [];

  for (const tool of tools) {
    if (!tool.enabled) continue;

    if (tool.type === 'builtin') {
      if (tool.id === 'web_search') {
        definitions.push({ type: 'web_search' });
      } else if (tool.id === 'x_search') {
        definitions.push({ type: 'x_search' });
      } else if (tool.id === 'code_execution') {
        definitions.push({ type: 'code_execution' });
      }
    } else if (tool.type === 'mcp' && tool.serverUrl) {
      definitions.push({
        type: 'mcp',
        server_url: tool.serverUrl,
        server_label: tool.serverLabel ?? tool.name.toLowerCase(),
      });
    }
  }

  // Include image generation tool only if enabled
  const imageEnabled = tools.find((t) => t.id === 'image_generation')?.enabled ?? true;
  if (imageEnabled) {
    definitions.push({
      type: 'function',
      name: 'generate_image',
      description:
        'Generate an image from a text prompt using the xAI image generation model. Use when the user asks to draw, illustrate, visualize, or create an image of something. Returns the image inline in the conversation.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Detailed text prompt describing the image to generate. Be descriptive and specific for best results.',
          },
        },
        required: ['prompt'],
      },
    });
  }

  // Include video generation tool only if enabled
  const videoEnabled = tools.find((t) => t.id === 'video_generation')?.enabled ?? true;
  if (videoEnabled) {
    definitions.push({
      type: 'function',
      name: 'generate_video',
      description:
        'Generate a short video (10 seconds, 720p) from a text prompt using xAI native video model. Use when the user asks to create a video, animation, or motion content. Produces cinematic, impressive results. Always make video prompts vivid, dramatic, and visually stunning — think Hollywood cinematography.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Detailed cinematic text prompt describing the video to generate. Be vivid, dramatic, and specific. Include camera movements, lighting, atmosphere. Think movie trailer quality.',
          },
        },
        required: ['prompt'],
      },
    });
  }

  // Always include the client-side function tools
  definitions.push(
    {
      type: 'function',
      name: 'open_link',
      description:
        'Suggest opening an external link relevant to the conversation. Use when referencing a specific URL from the knowledge base. Maximum 2 calls per response.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'The full URL to open (must be from the knowledge base, do not invent URLs)',
          },
          label: {
            type: 'string',
            description: 'Short button label describing the link',
          },
        },
        required: ['url', 'label'],
      },
    },
    {
      type: 'function',
      name: 'navigate',
      description:
        'Suggest navigating to a page on this website. Use when directing the user to a section of the site.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The site path to navigate to (e.g., "/", "/cybernus")',
          },
          label: {
            type: 'string',
            description: 'Short button label',
          },
        },
        required: ['url', 'label'],
      },
    },
  );

  return definitions;
}

/** Create a tool call record for tracking. */
export function createToolCall(
  id: string,
  toolName: string,
  args: string,
  serverLabel?: string,
): AgentToolCall {
  return {
    id,
    toolName,
    ...(serverLabel !== undefined ? { serverLabel } : {}),
    arguments: args,
    status: 'pending',
    timestamp: Date.now(),
  };
}

/** Map raw API tool calls to ToolAction objects for the UI. */
export function mapToolCallsToActions(
  toolCalls: { id: string; name: string; arguments: string }[],
): { type: 'navigate' | 'open_link'; label: string; url: string }[] {
  const actions: { type: 'navigate' | 'open_link'; label: string; url: string }[] = [];

  for (const call of toolCalls) {
    try {
      const args = JSON.parse(call.arguments) as { url?: string; label?: string };
      if (!args.url) continue;

      actions.push({
        type: call.name === 'navigate' ? 'navigate' : 'open_link',
        label: args.label ?? args.url,
        url: args.url,
      });
    } catch {
      // Skip malformed tool call arguments
    }
  }

  return actions;
}

/** Execute a tool action. */
export function executeAction(action: { type: string; url: string }): void {
  if (action.type === 'navigate') {
    window.location.href = action.url;
  } else {
    window.open(action.url, '_blank', 'noopener,noreferrer');
  }
}
