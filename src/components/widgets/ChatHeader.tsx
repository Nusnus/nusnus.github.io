import { useLanguage } from '@hooks/useLanguage';

/**
 * Chat header with translatable title and subtitle.
 * Used in the chat page header.
 */
export default function ChatHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3">
      <div
        className="bg-accent/10 ring-accent/30 flex h-8 w-8 items-center justify-center rounded-lg ring-1"
        style={{
          boxShadow:
            '0 0 12px oklch(0.72 0.17 145 / 0.2), inset 0 0 8px oklch(0.72 0.17 145 / 0.1)',
        }}
      >
        <svg
          className="text-accent h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
        </svg>
      </div>
      <div>
        <h1
          className="text-accent font-mono text-base font-bold tracking-wide"
          style={{ textShadow: '0 0 8px oklch(0.72 0.17 145 / 0.4)' }}
        >
          {t('aiInterface')}
        </h1>
        <p className="text-text-muted text-[10px] font-medium tracking-wider uppercase">
          {t('neuralNetworkActive')}
        </p>
      </div>
    </div>
  );
}
