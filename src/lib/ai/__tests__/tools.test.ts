/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { getToolsForModel, mapToolCallsToActions } from '@lib/ai/tools';

describe('tools', () => {
  describe('getToolsForModel', () => {
    it('returns tool definitions for grok-4-1-fast', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.length).toBeGreaterThan(0);
    });

    it('includes web_search tool', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.some((t) => t.type === 'web_search')).toBe(true);
    });

    it('includes function tools (open_link, navigate)', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.some((t) => t.type === 'function' && t.name === 'open_link')).toBe(true);
      expect(tools.some((t) => t.type === 'function' && t.name === 'navigate')).toBe(true);
    });

    it('includes MCP tools', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.some((t) => t.type === 'mcp')).toBe(true);
    });

    it('includes x_search tool', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.some((t) => t.type === 'x_search')).toBe(true);
    });

    it('includes code_execution tool', () => {
      const tools = getToolsForModel('grok-4-1-fast');
      expect(tools.some((t) => t.type === 'code_execution')).toBe(true);
    });
  });

  describe('mapToolCallsToActions', () => {
    it('maps open_link calls to actions', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: '{"url":"https://github.com","label":"GitHub"}' },
      ]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('open_link');
      expect(actions[0]?.url).toBe('https://github.com');
    });

    it('maps navigate calls to actions', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'navigate', arguments: '{"url":"/cybernus","label":"Chat"}' },
      ]);
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('navigate');
    });

    it('handles multiple tool calls', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: '{"url":"https://a.com","label":"A"}' },
        { id: '2', name: 'navigate', arguments: '{"url":"/","label":"Home"}' },
      ]);
      expect(actions).toHaveLength(2);
    });

    it('skips calls without url', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: '{"label":"No URL"}' },
      ]);
      expect(actions).toHaveLength(0);
    });

    it('skips malformed JSON', () => {
      const actions = mapToolCallsToActions([
        { id: '1', name: 'open_link', arguments: 'not json' },
      ]);
      expect(actions).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
      expect(mapToolCallsToActions([])).toHaveLength(0);
    });
  });
});
