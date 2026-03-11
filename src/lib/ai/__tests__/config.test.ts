import { describe, it, expect } from 'vitest';
import {
  CLOUD_MODELS,
  DEFAULT_CLOUD_MODEL_ID,
  MAX_USER_MESSAGES,
  trimHistory,
  SUGGESTED_QUESTIONS,
} from '@lib/ai/config';

describe('AI config', () => {
  it('has exactly one model (single model architecture)', () => {
    expect(CLOUD_MODELS).toHaveLength(1);
  });

  it('default model is grok-4.20-beta-latest-non-reasoning', () => {
    expect(DEFAULT_CLOUD_MODEL_ID).toBe('grok-4.20-beta-latest-non-reasoning');
  });

  it('default model is marked as recommended', () => {
    expect(CLOUD_MODELS[0]?.recommended).toBe(true);
  });

  it('has a reasonable message limit', () => {
    expect(MAX_USER_MESSAGES).toBeGreaterThan(0);
    expect(MAX_USER_MESSAGES).toBeLessThanOrEqual(100);
  });

  it('has suggested questions with icon, label, and prompt', () => {
    expect(SUGGESTED_QUESTIONS.length).toBeGreaterThan(0);
    for (const q of SUGGESTED_QUESTIONS) {
      expect(q.icon.length).toBeGreaterThan(0);
      expect(q.label.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });

  describe('trimHistory', () => {
    it('returns all messages when under limit', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];
      const trimmed = trimHistory(messages);
      expect(trimmed).toHaveLength(2);
    });

    it('trims oldest messages when over limit', () => {
      const longContent = 'x'.repeat(25001);
      const messages = [
        { role: 'user' as const, content: longContent },
        { role: 'assistant' as const, content: longContent },
        { role: 'user' as const, content: 'Recent message' },
      ];
      const trimmed = trimHistory(messages);
      expect(trimmed.length).toBeLessThan(messages.length);
      expect(trimmed[trimmed.length - 1]?.content).toBe('Recent message');
    });

    it('always keeps at least one message', () => {
      const longContent = 'x'.repeat(100000);
      const messages = [{ role: 'user' as const, content: longContent }];
      const trimmed = trimHistory(messages);
      expect(trimmed).toHaveLength(1);
    });
  });
});
