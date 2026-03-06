import { useLanguage } from '@hooks/useLanguage';

/**
 * Language toggle button that switches between English and Spanish.
 * Stores preference in localStorage and syncs across all components.
 */
export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggle = () => {
    setLanguage(language === 'en' ? 'es' : 'en');
  };

  return (
    <button
      onClick={toggle}
      aria-label={language === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
      className="text-text-muted hover:bg-bg-surface hover:text-accent focus-visible:ring-accent flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="font-mono text-sm font-bold">{language === 'en' ? 'ES' : 'EN'}</span>
    </button>
  );
}
