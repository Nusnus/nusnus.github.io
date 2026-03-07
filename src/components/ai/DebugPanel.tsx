/**
 * DebugPanel — collapsible diagnostics panel for Cybernus.
 *
 * Shows: streaming logs, API timings, session state, voice diagnostics,
 * network status, and searchable log history.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bug, X, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@lib/utils/cn';

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'stream' | 'api' | 'session' | 'voice' | 'network' | 'ui';
  message: string;
  data?: Record<string, unknown>;
}

export interface DebugState {
  logs: DebugLogEntry[];
  streamTokenCount: number;
  streamStartTime: number | null;
  streamEndTime: number | null;
  apiRequestCount: number;
  lastApiLatency: number | null;
  activeSessionId: string | null;
  messageCount: number;
  personalityLevel: number;
  language: string;
  isGenerating: boolean;
  engineState: string;
}

interface DebugPanelProps {
  state: DebugState;
  onClearLogs: () => void;
}

const LEVEL_COLORS: Record<DebugLogEntry['level'], string> = {
  info: 'text-cyan-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-[#00ff41]/60',
};

const LEVEL_BG: Record<DebugLogEntry['level'], string> = {
  info: 'bg-cyan-400/10',
  warn: 'bg-yellow-400/10',
  error: 'bg-red-400/10',
  debug: 'bg-[#00ff41]/5',
};

const CATEGORY_LABELS: Record<DebugLogEntry['category'], string> = {
  stream: 'STRM',
  api: 'API',
  session: 'SESS',
  voice: 'VOIC',
  network: 'NET',
  ui: 'UI',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
}

/** Collapsible debug/diagnostics panel. */
export function DebugPanel({ state, onClearLogs }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showSection, setShowSection] = useState<'logs' | 'state'>('logs');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && isOpen && showSection === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.logs.length, autoScroll, isOpen, showSection]);

  const filteredLogs = search
    ? state.logs.filter(
        (l) =>
          l.message.toLowerCase().includes(search.toLowerCase()) ||
          l.category.includes(search.toLowerCase()),
      )
    : state.logs;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!state.streamStartTime || state.streamEndTime) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.streamStartTime, state.streamEndTime]);

  const streamDuration =
    state.streamStartTime && state.streamEndTime
      ? ((state.streamEndTime - state.streamStartTime) / 1000).toFixed(2)
      : state.streamStartTime
        ? ((now - state.streamStartTime) / 1000).toFixed(1)
        : null;

  const tokensPerSecond =
    streamDuration && state.streamTokenCount > 0
      ? (state.streamTokenCount / parseFloat(streamDuration)).toFixed(1)
      : null;

  // Toggle button (always visible)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-20 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#00ff41]/20 bg-black/80 text-[#00ff41]/50 shadow-lg backdrop-blur-sm transition-all hover:border-[#00ff41]/40 hover:text-[#00ff41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)]"
        aria-label="Open debug panel"
        title="Debug Panel"
      >
        <Bug className="h-4 w-4" />
        {state.logs.some((l) => l.level === 'error') && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-0 bottom-0 z-50 flex w-full flex-col border-t border-[#00ff41]/20 bg-black/95 shadow-[0_-4px_30px_rgba(0,0,0,0.8)] backdrop-blur-md sm:right-4 sm:bottom-4 sm:w-[420px] sm:rounded-xl sm:border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#00ff41]/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bug className="h-3.5 w-3.5 text-[#00ff41]" />
          <span className="text-xs font-semibold tracking-wider text-[#00ff41]">DEBUG</span>
          {state.isGenerating && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              STREAMING
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClearLogs}
            className="rounded p-1 text-[#00ff41]/30 transition-colors hover:bg-[#00ff41]/10 hover:text-[#00ff41]/60"
            title="Clear logs"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-[#00ff41]/30 transition-colors hover:bg-[#00ff41]/10 hover:text-[#00ff41]/60"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="flex items-center gap-3 border-b border-[#00ff41]/5 px-3 py-1.5 text-[10px]">
        <span className="text-[#00ff41]/40">
          Tokens: <span className="text-[#00ff41]/70">{state.streamTokenCount}</span>
        </span>
        {tokensPerSecond && (
          <span className="text-[#00ff41]/40">
            Speed: <span className="text-[#00ff41]/70">{tokensPerSecond} t/s</span>
          </span>
        )}
        {streamDuration && (
          <span className="text-[#00ff41]/40">
            Time: <span className="text-[#00ff41]/70">{streamDuration}s</span>
          </span>
        )}
        {state.lastApiLatency !== null && (
          <span className="text-[#00ff41]/40">
            Latency: <span className="text-[#00ff41]/70">{state.lastApiLatency}ms</span>
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-[#00ff41]/5">
        <button
          onClick={() => setShowSection('logs')}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-medium tracking-wider transition-colors',
            showSection === 'logs'
              ? 'border-b border-[#00ff41] text-[#00ff41]'
              : 'text-[#00ff41]/30 hover:text-[#00ff41]/60',
          )}
        >
          LOGS ({filteredLogs.length})
        </button>
        <button
          onClick={() => setShowSection('state')}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-medium tracking-wider transition-colors',
            showSection === 'state'
              ? 'border-b border-[#00ff41] text-[#00ff41]'
              : 'text-[#00ff41]/30 hover:text-[#00ff41]/60',
          )}
        >
          STATE
        </button>
      </div>

      {showSection === 'logs' && (
        <>
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-[#00ff41]/5 px-3 py-1.5">
            <Search className="h-3 w-3 text-[#00ff41]/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs..."
              className="flex-1 bg-transparent text-[10px] text-[#00ff41]/70 outline-none placeholder:text-[#00ff41]/20"
            />
          </div>

          {/* Log entries */}
          <div
            className="cybernus-scrollbar max-h-56 overflow-y-auto font-mono text-[10px] sm:max-h-72"
            onScroll={handleScroll}
          >
            {filteredLogs.length === 0 ? (
              <p className="px-3 py-4 text-center text-[#00ff41]/20">No logs yet</p>
            ) : (
              filteredLogs.map((entry) => <LogEntry key={entry.id} entry={entry} />)
            )}
            <div ref={logsEndRef} />
          </div>
        </>
      )}

      {showSection === 'state' && (
        <div className="cybernus-scrollbar max-h-56 overflow-y-auto px-3 py-2 font-mono text-[10px] sm:max-h-72">
          <StateRow label="Engine" value={state.engineState} />
          <StateRow
            label="Generating"
            value={state.isGenerating ? 'YES' : 'no'}
            highlight={state.isGenerating}
          />
          <StateRow label="Session" value={state.activeSessionId ?? '(none)'} />
          <StateRow label="Messages" value={String(state.messageCount)} />
          <StateRow label="Personality" value={String(state.personalityLevel)} />
          <StateRow label="Language" value={state.language} />
          <StateRow label="API Requests" value={String(state.apiRequestCount)} />
          <StateRow label="Stream Tokens" value={String(state.streamTokenCount)} />
          {state.lastApiLatency !== null && (
            <StateRow label="Last Latency" value={`${state.lastApiLatency}ms`} />
          )}
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry }: { entry: DebugLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = entry.data && Object.keys(entry.data).length > 0;

  return (
    <div
      className={cn(
        'border-b border-[#00ff41]/5 px-3 py-1 transition-colors hover:bg-[#00ff41]/[0.02]',
        entry.level === 'error' && 'bg-red-500/[0.03]',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 text-[#00ff41]/20">{formatTime(entry.timestamp)}</span>
        <span className={cn('shrink-0 font-bold', LEVEL_COLORS[entry.level])}>
          [{entry.level.toUpperCase()}]
        </span>
        <span
          className={cn('shrink-0 rounded px-1', LEVEL_BG[entry.level], LEVEL_COLORS[entry.level])}
        >
          {CATEGORY_LABELS[entry.category]}
        </span>
        <span className="flex-1 text-gray-300">{entry.message}</span>
        {hasData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-[#00ff41]/30 hover:text-[#00ff41]/60"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>
      {expanded && hasData && (
        <pre className="mt-1 overflow-x-auto rounded bg-[#00ff41]/5 p-1.5 text-[9px] text-[#00ff41]/50">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function StateRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#00ff41]/5 py-1">
      <span className="text-[#00ff41]/40">{label}</span>
      <span className={cn('text-[#00ff41]/70', highlight && 'font-bold text-cyan-400')}>
        {value}
      </span>
    </div>
  );
}

/** Create a new debug log entry. */
export function createLogEntry(
  level: DebugLogEntry['level'],
  category: DebugLogEntry['category'],
  message: string,
  data?: Record<string, unknown>,
): DebugLogEntry {
  const entry: DebugLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level,
    category,
    message,
  };
  if (data !== undefined) {
    entry.data = data;
  }
  return entry;
}
