import { describe, it, expect } from 'vitest';
import {
  MODEL_ID,
  MODEL_NAME,
  MAX_USER_MESSAGES,
  trimHistory,
  SUGGESTED_QUESTIONS,
} from '@lib/ai/config';
import type { Language } from '@lib/ai/i18n';

describe('AI config', () => {
  it('uses grok-4-1-fast as the model', () => {
    expect(MODEL_ID).toBe('grok-4-1-fast');
  });

  it('has a model name', () => {
    expect(MODEL_NAME).toBe('Grok 4');
  });

  it('has reasonable message limits', () => {
    expect(MAX_USER_MESSAGES).toBeGreaterThanOrEqual(30);
    expect(MAX_USER_MESSAGES).toBeLessThanOrEqual(100);
  });
});

describe('trimHistory', () => {
  it('passes through short histories unchanged', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
    ];
    const result = trimHistory(messages);
    expect(result).toHaveLength(2);
  });

  it('keeps the most recent messages when trimming', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i} ${'x'.repeat(1000)}`,
    }));
    const result = trimHistory(messages);
    expect(result.length).toBeLessThanOrEqual(messages.length);
    // Last message should always be preserved
    const lastOriginal = messages[messages.length - 1];
    const lastTrimmed = result[result.length - 1];
    expect(lastTrimmed?.content).toBe(lastOriginal?.content);
  });
});

describe('SUGGESTED_QUESTIONS', () => {
  it('has questions for all supported languages', () => {
    const langs: Language[] = ['en', 'es', 'he'];
    for (const lang of langs) {
      expect(SUGGESTED_QUESTIONS[lang]).toBeDefined();
      expect(SUGGESTED_QUESTIONS[lang].length).toBeGreaterThan(0);
    }
  });

  it('has 4 questions per language', () => {
    expect(SUGGESTED_QUESTIONS.en).toHaveLength(4);
    expect(SUGGESTED_QUESTIONS.es).toHaveLength(4);
    expect(SUGGESTED_QUESTIONS.he).toHaveLength(4);
  });
});
