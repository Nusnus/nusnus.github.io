/**
 * SearchOverlay — Ctrl+K search across all chat history.
 *
 * Full-text search with highlighted results and session navigation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@lib/utils/cn';
import { searchHistory, getMatchSnippet } from '@lib/cybernus/services/SearchService';
import type { SearchResult } from '@lib/cybernus/types';
import type { Language } from '@lib/ai/i18n';
import { t } from '@lib/ai/i18n';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (sessionId: string) => void;
  language: Language;
}

export function SearchOverlay({ isOpen, onClose, onSelectResult, language }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const strings = t(language);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length >= 2) {
      setResults(searchHistory(value));
    } else {
      setResults([]);
    }
  }, []);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelectResult(result.sessionId);
      handleClose();
    },
    [onSelectResult, handleClose],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Search panel */}
      <div className="relative w-full max-w-lg rounded-xl border border-[#00ff41]/20 bg-[#0a0f0a] p-4 shadow-2xl shadow-[#00ff41]/5">
        {/* Search input */}
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#00ff41]/10 bg-black/40 px-3 py-2">
          <svg
            className="h-4 w-4 text-[#00ff41]/50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={strings.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/30">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[40vh] overflow-y-auto">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result) => {
                const snippet = getMatchSnippet(result.content, result.matchStart, result.matchEnd);
                return (
                  <button
                    key={`${result.sessionId}-${result.messageId}`}
                    onClick={() => handleSelect(result)}
                    className="group w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#00ff41]/5"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-medium',
                          result.messageRole === 'user' ? 'text-blue-400' : 'text-[#00ff41]',
                        )}
                      >
                        {result.messageRole === 'user' ? 'You' : 'Cybernus'}
                      </span>
                      <span className="text-[10px] text-white/20">{result.sessionTitle}</span>
                    </div>
                    <p className="text-xs text-white/60">
                      {snippet.before}
                      <span className="bg-[#00ff41]/20 font-medium text-[#00ff41]">
                        {snippet.match}
                      </span>
                      {snippet.after}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 ? (
            <p className="py-8 text-center text-xs text-white/30">{strings.noResults}</p>
          ) : (
            <p className="py-8 text-center text-xs text-white/30">{strings.searchPlaceholder}</p>
          )}
        </div>
      </div>
    </div>
  );
}
