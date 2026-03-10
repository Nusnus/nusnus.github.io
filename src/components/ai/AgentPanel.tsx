/**
 * AgentPanel — right sidebar showing MCP tools and agent activity.
 *
 * Displays active tools, allows toggling, and shows tool invocation history.
 */

import { useState, useCallback } from 'react';
import { cn } from '@lib/utils/cn';
import { loadTools, toggleTool } from '@lib/cybernus/services/AgentService';
import type { AgentTool } from '@lib/cybernus/types';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface AgentPanelProps {
  language: Language;
  activeToolCalls: string[];
  onClose?: () => void;
}

const TOOL_ICONS: Record<string, string> = {
  globe:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  twitter:
    'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  image: 'M21 3H3v18h18V3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
};

export function AgentPanel({ language, activeToolCalls, onClose }: AgentPanelProps) {
  const [tools, setTools] = useState<AgentTool[]>(loadTools);
  const strings = t(language);

  const handleToggle = useCallback((toolId: string, enabled: boolean) => {
    const updated = toggleTool(toolId, enabled);
    setTools(updated);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#00ff41]/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-[#00ff41]/70 uppercase">
            {strings.agents}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60 xl:hidden"
              aria-label="Close"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-white/30">{strings.agentsDescription}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {tools.map((tool) => {
            const isActive =
              activeToolCalls.includes(tool.id) ||
              activeToolCalls.includes(tool.name.toLowerCase());
            return (
              <div
                key={tool.id}
                className={cn(
                  'rounded-lg border p-3 transition-all',
                  isActive
                    ? 'border-[#00ff41]/40 bg-[#00ff41]/5'
                    : tool.enabled
                      ? 'border-white/5 bg-white/[0.02]'
                      : 'border-white/5 bg-transparent opacity-50',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className={cn('h-3.5 w-3.5', isActive ? 'text-[#00ff41]' : 'text-white/40')}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={TOOL_ICONS[tool.icon] ?? TOOL_ICONS.globe} />
                    </svg>
                    <span className="text-xs font-medium text-white/80">{tool.name}</span>
                    {isActive && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-[#00ff41] opacity-40" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff41]" />
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggle(tool.id, !tool.enabled)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors',
                      tool.enabled ? 'bg-[#00ff41]/10 text-[#00ff41]' : 'bg-white/5 text-white/30',
                    )}
                  >
                    {tool.enabled ? strings.toolActive : strings.toolInactive}
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-white/30">{tool.description}</p>
                {tool.type === 'mcp' && tool.serverUrl && (
                  <p className="mt-1 font-mono text-[9px] text-white/15">
                    MCP: {tool.serverLabel ?? tool.serverUrl}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
