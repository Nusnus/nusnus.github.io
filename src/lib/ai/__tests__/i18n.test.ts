import { describe, it, expect } from 'vitest';
import { t, getLanguage, getLanguageOption, LANGUAGES } from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';

describe('i18n translations', () => {
  it('returns all required string keys for each language', () => {
    const requiredKeys = [
      'welcome',
      'placeholder',
      'poweredBy',
      'newChat',
      'history',
      'clearAll',
      'noHistory',
      'messages',
      'startNewChat',
      'messageLimitReached',
      'searchingWeb',
      'foundResults',
      'voiceStart',
      'voiceStop',
      'voiceError',
      'personality',
      'personalityLevel',
      'language',
      'send',
      'stop',
      'diagnostics',
      'searchHistory',
    ] as const;

    const languages: Language[] = ['en', 'es', 'he'];
    for (const lang of languages) {
      const strings = t(lang);
      for (const key of requiredKeys) {
        expect(strings[key], `Missing key "${key}" for language "${lang}"`).toBeTruthy();
      }
    }
  });

  it('returns English strings for "en"', () => {
    const strings = t('en');
    expect(strings.welcome).toContain('Cybernus');
    expect(strings.placeholder).toContain('Cybernus');
  });

  it('returns Spanish strings for "es"', () => {
    const strings = t('es');
    expect(strings.welcome).toContain('Cybernus');
    expect(strings.history).toBe('Historial');
  });

  it('returns Hebrew strings for "he"', () => {
    const strings = t('he');
    expect(strings.welcome).toContain('סייברנוס');
  });

  it('has searchHistory for all languages', () => {
    expect(t('en').searchHistory).toBe('Search chats...');
    expect(t('es').searchHistory).toBe('Buscar chats...');
    expect(t('he').searchHistory).toBeTruthy();
  });
});

describe('LANGUAGES config', () => {
  it('has exactly 3 languages', () => {
    expect(LANGUAGES).toHaveLength(3);
  });

  it('includes English, Spanish, and Hebrew', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(codes).toContain('he');
  });

  it('Hebrew is marked as RTL', () => {
    const he = LANGUAGES.find((l) => l.code === 'he');
    expect(he?.dir).toBe('rtl');
  });

  it('English and Spanish are marked as LTR', () => {
    const en = LANGUAGES.find((l) => l.code === 'en');
    const es = LANGUAGES.find((l) => l.code === 'es');
    expect(en?.dir).toBe('ltr');
    expect(es?.dir).toBe('ltr');
  });
});

describe('getLanguageOption', () => {
  it('returns correct language option by code', () => {
    const en = getLanguageOption('en');
    expect(en.code).toBe('en');
    expect(en.label).toBe('English');

    const he = getLanguageOption('he');
    expect(he.code).toBe('he');
    expect(he.dir).toBe('rtl');
  });
});

describe('getLanguage', () => {
  it('defaults to English when no preference is stored', () => {
    const lang = getLanguage();
    expect(lang).toBe('en');
  });
});
