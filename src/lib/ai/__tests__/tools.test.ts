/**
 * Tests for AI tool definitions and tool call mapping.
 *
 * Verifies that:
 * 1. CLOUD_TOOLS includes web_search
 * 2. Tool definitions have the correct structure
 * 3. Tool call mapping works correctly
 */

import { describe, it, expect } from 'vitest';
import { CLOUD_TOOLS, mapToolCallsToActions } from '@lib/ai/tools';
import type { ToolCallResult } from '@lib/ai/tools';

describe('CLOUD_TOOLS', () => {
  it('includes web_search as the first tool', () => {
    expect(CLOUD_TOOLS.length).toBeGreaterThan(0);
    expect(CLOUD_TOOLS[0]).toEqual({ type: 'web_search' });
  });

  it('includes function tools after web_search', () => {
    const functionTools = CLOUD_TOOLS.filter((tool) => tool.type === 'function');
    expect(functionTools.length).toBeGreaterThan(0);
  });

  it('has open_link function tool', () => {
    const openLinkTool = CLOUD_TOOLS.find(
      (tool) => tool.type === 'function' && 'name' in tool && tool.name === 'open_link',
    );
    expect(openLinkTool).toBeDefined();
    if (openLinkTool && openLinkTool.type === 'function') {
      expect(openLinkTool.description).toBeTruthy();
      expect(openLinkTool.parameters).toBeDefined();
    }
  });

  it('has navigate function tool', () => {
    const navigateTool = CLOUD_TOOLS.find(
      (tool) => tool.type === 'function' && 'name' in tool && tool.name === 'navigate',
    );
    expect(navigateTool).toBeDefined();
    if (navigateTool && navigateTool.type === 'function') {
      expect(navigateTool.description).toBeTruthy();
      expect(navigateTool.parameters).toBeDefined();
    }
  });
});

describe('mapToolCallsToActions', () => {
  it('maps open_link tool calls correctly', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_1',
        name: 'open_link',
        arguments: JSON.stringify({ url: 'https://example.com', label: 'Example' }),
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: 'open_link',
      url: 'https://example.com',
      label: 'Example',
    });
  });

  it('maps navigate tool calls correctly', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_2',
        name: 'navigate',
        arguments: JSON.stringify({ url: '/chat', label: 'Go to Chat' }),
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: 'navigate',
      url: '/chat',
      label: 'Go to Chat',
    });
  });

  it('skips tool calls without url', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_3',
        name: 'open_link',
        arguments: JSON.stringify({ label: 'No URL' }),
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(0);
  });

  it('handles malformed JSON gracefully', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_4',
        name: 'open_link',
        arguments: 'invalid json',
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(0);
  });

  it('uses url as label fallback when label is missing', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_5',
        name: 'open_link',
        arguments: JSON.stringify({ url: 'https://example.com' }),
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.label).toBe('https://example.com');
  });

  it('processes multiple tool calls', () => {
    const toolCalls: ToolCallResult[] = [
      {
        id: 'call_6',
        name: 'open_link',
        arguments: JSON.stringify({ url: 'https://example.com', label: 'Example' }),
      },
      {
        id: 'call_7',
        name: 'navigate',
        arguments: JSON.stringify({ url: '/', label: 'Home' }),
      },
    ];

    const actions = mapToolCallsToActions(toolCalls);
    expect(actions).toHaveLength(2);
    expect(actions[0]?.type).toBe('open_link');
    expect(actions[1]?.type).toBe('navigate');
  });
});
