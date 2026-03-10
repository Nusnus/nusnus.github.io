/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTools,
  saveTools,
  toggleTool,
  buildToolDefinitions,
  createToolCall,
  mapToolCallsToActions,
  executeAction,
} from '@lib/cybernus/services/AgentService';

describe('AgentService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadTools', () => {
    it('returns default tools when localStorage is empty', () => {
      const tools = loadTools();
      expect(tools.length).toBeGreaterThanOrEqual(4);
      expect(tools.find((t) => t.id === 'web_search')).toBeDefined();
      expect(tools.find((t) => t.id === 'x_search')).toBeDefined();
      expect(tools.find((t) => t.id === 'code_execution')).toBeDefined();
      expect(tools.find((t) => t.id === 'deepwiki')).toBeDefined();
    });

    it('all default tools are enabled', () => {
      const tools = loadTools();
      expect(tools.every((t) => t.enabled)).toBe(true);
    });

    it('restores saved tools from localStorage', () => {
      const custom = [
        {
          id: 'web_search',
          name: 'Web Search',
          description: 'test',
          type: 'builtin' as const,
          enabled: false,
          icon: 'globe',
        },
      ];
      localStorage.setItem('cybernus-agent-tools', JSON.stringify(custom));
      const tools = loadTools();
      const ws = tools.find((t) => t.id === 'web_search');
      expect(ws?.enabled).toBe(false);
    });

    it('merges new default tools with saved tools', () => {
      const custom = [
        {
          id: 'web_search',
          name: 'Web Search',
          description: 'test',
          type: 'builtin' as const,
          enabled: true,
          icon: 'globe',
        },
      ];
      localStorage.setItem('cybernus-agent-tools', JSON.stringify(custom));
      const tools = loadTools();
      // Should have the saved web_search + the other defaults
      expect(tools.length).toBeGreaterThan(1);
    });
  });

  describe('saveTools / toggleTool', () => {
    it('toggleTool persists the change', () => {
      toggleTool('web_search', false);
      const tools = loadTools();
      expect(tools.find((t) => t.id === 'web_search')?.enabled).toBe(false);
    });

    it('toggleTool returns updated tools array', () => {
      const result = toggleTool('deepwiki', false);
      expect(result.find((t) => t.id === 'deepwiki')?.enabled).toBe(false);
    });

    it('saveTools persists to localStorage', () => {
      const tools = loadTools();
      const firstTool = tools[0];
      expect(firstTool).toBeDefined();
      if (firstTool) firstTool.enabled = false;
      saveTools(tools);
      const stored = JSON.parse(localStorage.getItem('cybernus-agent-tools') ?? '[]');
      expect(stored[0]?.enabled).toBe(false);
    });
  });

  describe('buildToolDefinitions', () => {
    it('includes web_search for enabled builtin tools', () => {
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      expect(defs.some((d) => d.type === 'web_search')).toBe(true);
    });

    it('includes x_search for enabled builtin tools', () => {
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      expect(defs.some((d) => d.type === 'x_search')).toBe(true);
    });

    it('includes code_execution for enabled builtin tools', () => {
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      expect(defs.some((d) => d.type === 'code_execution')).toBe(true);
    });

    it('includes mcp tool with server_url for DeepWiki', () => {
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      const mcp = defs.find((d) => d.type === 'mcp');
      expect(mcp).toBeDefined();
      expect(mcp?.server_url).toBe('https://mcp.deepwiki.com/mcp');
    });

    it('always includes function tools (open_link, navigate)', () => {
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      expect(defs.some((d) => d.type === 'function' && d.name === 'open_link')).toBe(true);
      expect(defs.some((d) => d.type === 'function' && d.name === 'navigate')).toBe(true);
    });

    it('excludes disabled tools', () => {
      toggleTool('web_search', false);
      const tools = loadTools();
      const defs = buildToolDefinitions(tools);
      expect(defs.some((d) => d.type === 'web_search')).toBe(false);
    });
  });

  describe('createToolCall', () => {
    it('creates a tool call record with pending status', () => {
      const call = createToolCall('test-id', 'web_search', '{"query":"test"}');
      expect(call.id).toBe('test-id');
      expect(call.toolName).toBe('web_search');
      expect(call.arguments).toBe('{"query":"test"}');
      expect(call.status).toBe('pending');
      expect(call.timestamp).toBeGreaterThan(0);
    });

    it('includes serverLabel when provided', () => {
      const call = createToolCall('id', 'deepwiki', '{}', 'deepwiki');
      expect(call.serverLabel).toBe('deepwiki');
    });

    it('omits serverLabel when not provided', () => {
      const call = createToolCall('id', 'web_search', '{}');
      expect('serverLabel' in call).toBe(false);
    });
  });

  describe('mapToolCallsToActions', () => {
    it('maps open_link tool calls to actions', () => {
      const actions = mapToolCallsToActions([
        {
          id: '1',
          name: 'open_link',
          arguments: '{"url":"https://example.com","label":"Example"}',
        },
      ]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('open_link');
      expect(actions[0]?.url).toBe('https://example.com');
      expect(actions[0]?.label).toBe('Example');
    });

    it('maps navigate tool calls', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'navigate', arguments: '{"url":"/cybernus","label":"Chat"}' },
      ]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('navigate');
    });

    it('skips tool calls without url', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: '{"label":"No URL"}' },
      ]);
      expect(actions).toHaveLength(0);
    });

    it('skips malformed JSON arguments', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: 'invalid json' },
      ]);
      expect(actions).toHaveLength(0);
    });
  });

  describe('executeAction', () => {
    it('opens external links in new tab', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      executeAction({ type: 'open_link', url: 'https://example.com' });
      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
      openSpy.mockRestore();
    });
  });
});
