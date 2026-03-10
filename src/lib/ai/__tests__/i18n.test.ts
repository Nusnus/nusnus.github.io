/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLanguage,
  setLanguage,
  getLanguageOption,
  LANGUAGES,
  t,
  getLanguageInstruction,
} from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('LANGUAGES', () => {
    it('has three languages: English, Spanish, Hebrew', () => {
      expect(LANGUAGES).toHaveLength(3);
      const codes = LANGUAGES.map((l) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('he');
    });

    it('Hebrew is RTL', () => {
      const he = LANGUAGES.find((l) => l.code === 'he');
      expect(he?.dir).toBe('rtl');
    });

    it('English and Spanish are LTR', () => {
      expect(LANGUAGES.find((l) => l.code === 'en')?.dir).toBe('ltr');
      expect(LANGUAGES.find((l) => l.code === 'es')?.dir).toBe('ltr');
    });
  });

  describe('getLanguage / setLanguage', () => {
    it('defaults to English', () => {
      expect(getLanguage()).toBe('en');
    });

    it('persists language choice', () => {
      setLanguage('es');
      expect(getLanguage()).toBe('es');
    });

    it('handles invalid stored values gracefully', () => {
      localStorage.setItem('cybernus-language', 'invalid');
      expect(getLanguage()).toBe('en');
    });
  });

  describe('getLanguageOption', () => {
    it('returns correct option for each language', () => {
      expect(getLanguageOption('en').code).toBe('en');
      expect(getLanguageOption('es').code).toBe('es');
      expect(getLanguageOption('he').code).toBe('he');
    });
  });

  describe('t() translations', () => {
    const allLanguages: Language[] = ['en', 'es', 'he'];

    it('has all required keys in every language', () => {
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
        'search',
        'searchPlaceholder',
        'noResults',
        'agents',
        'agentsDescription',
        'toolActive',
        'toolInactive',
        'readAloud',
        'stopReading',
        'usingTool',
        'toolComplete',
        'searchingX',
        'executingCode',
        'queryingMcp',
      ];

      for (const lang of allLanguages) {
        const strings = t(lang);
        for (const key of requiredKeys) {
          expect(strings[key as keyof typeof strings], `Missing ${key} in ${lang}`).toBeTruthy();
        }
      }
    });

    it('welcome messages contain "Cybernus"', () => {
      for (const lang of allLanguages) {
        const strings = t(lang);
        const hasCybernus =
          strings.welcome.includes('Cybernus') || strings.welcome.includes('סייברנוס');
        expect(hasCybernus, `Welcome in ${lang} should mention Cybernus`).toBe(true);
      }
    });
  });

  describe('getLanguageInstruction', () => {
    it('returns empty for English', () => {
      expect(getLanguageInstruction('en')).toBe('');
    });

    it('returns Spanish instruction for es', () => {
      const inst = getLanguageInstruction('es');
      expect(inst).toContain('Spanish');
      expect(inst).toContain('Colombian');
    });

    it('returns Hebrew instruction for he', () => {
      const inst = getLanguageInstruction('he');
      expect(inst).toContain('Hebrew');
      expect(inst).toContain('RTL');
    });
  });
});
