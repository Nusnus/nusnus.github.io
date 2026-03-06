import { useState, useEffect, useCallback } from 'react';
import { type Language, type Translations, getTranslation } from '@lib/i18n/translations';

const STORAGE_KEY = 'preferred-language';
const LANGUAGE_CHANGE_EVENT = 'language-change';

/**
 * Custom hook to manage language preference and provide translation function.
 * Syncs language state across all components using localStorage and custom events.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize from localStorage or default to English
    if (typeof window === 'undefined') return 'en';

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'es') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'en';
  });

  // Listen for language changes from other components
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      setLanguageState(customEvent.detail);
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  }, []);

  // Function to change language
  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);

    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // Ignore localStorage errors
    }

    // Dispatch custom event to sync across components
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: newLang }));
  }, []);

  // Translation function
  const t = useCallback(
    (key: keyof Translations, params?: Record<string, string | number>) => {
      return getTranslation(language, key, params);
    },
    [language],
  );

  return { language, setLanguage, t };
}
