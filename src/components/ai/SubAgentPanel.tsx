/**
 * SubAgentPanel — visual task decomposition sidebar component.
 *
 * Shows active sub-agent tasks with animated status indicators.
 * Appears on the right side of the chat on desktop, or as an
 * overlay on mobile when triggered.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@lib/utils/cn';
import type { SubAgentTask, SubAgentIcon } from '@lib/ai/sub-agents';

/* ─── Icon mapping ─── */
const ICON_MAP: Record<SubAgentIcon, string> = {
  search: '🔍',
  data: '📊',
  analyze: '🧠',
  render: '🎨',
  web: '🌐',
  memory: '💾',
  guard: '🛡️',
};

/* ─── Status colors ─── */
function statusColor(status: SubAgentTask['status']): string {
  switch (status) {
    case 'pending':
      return 'text-text-muted';
    case 'running':
      return 'text-accent';
    case 'completed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
  }
}

function statusDot(status: SubAgentTask['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-text-muted/40';
    case 'running':
      return 'bg-accent animate-pulse';
    case 'completed':
      return 'bg-green-400';
    case 'failed':
      return 'bg-red-400';
  }
}

/* ─── Individual task row ─── */
function TaskRow({ task, index }: { task: SubAgentTask; index: number }) {
  const elapsed =
    task.status === 'completed' && task.completedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1)
      : task.status === 'running'
        ? '...'
        : null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-300',
        task.status === 'running' && 'bg-accent/5 border-accent/20 border',
        task.status === 'completed' && 'opacity-70',
        task.status === 'pending' && 'opacity-40',
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Status dot */}
      <div className="mt-1.5 flex shrink-0 items-center">
        <div className={cn('h-2 w-2 rounded-full', statusDot(task.status))} />
      </div>

      {/* Icon + content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs">{ICON_MAP[task.icon]}</span>
          <span
            className={cn(
              'text-sm leading-tight font-medium',
              statusColor(task.status),
              task.status === 'running' && 'animate-pulse',
            )}
          >
            {task.label}
          </span>
        </div>
        {task.detail && (
          <p className="text-text-muted mt-0.5 text-xs leading-snug">{task.detail}</p>
        )}
        {task.result && (
          <p className="mt-1 text-xs leading-snug text-green-400/80">{task.result}</p>
        )}
      </div>

      {/* Elapsed time */}
      {elapsed && (
        <span className="text-text-muted shrink-0 text-[10px] tabular-nums">{elapsed}s</span>
      )}
    </div>
  );
}

/* ─── Main panel ─── */
interface SubAgentPanelProps {
  tasks: SubAgentTask[];
  isVisible: boolean;
}

export function SubAgentPanel({ tasks, isVisible }: SubAgentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest running task
  useEffect(() => {
    if (scrollRef.current) {
      const running = scrollRef.current.querySelector('[class*="animate-pulse"]');
      running?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [tasks]);

  if (!isVisible || tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="border-accent/20 bg-bg-primary/95 flex h-full w-64 shrink-0 flex-col border-l backdrop-blur-sm xl:w-72">
      {/* Header */}
      <div className="border-accent/20 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-accent text-xs font-bold tracking-widest uppercase">Sub-Agents</h3>
          <span className="text-text-muted text-[10px] tabular-nums">
            {completed}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-bg-surface mt-2 h-1 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto p-2">
        {tasks.map((task, i) => (
          <TaskRow key={task.id} task={task} index={i} />
        ))}
      </div>

      {/* Footer */}
      {completed === total && total > 0 && (
        <div className="border-accent/20 border-t px-4 py-2">
          <p className="text-center text-[10px] text-green-400/60">All tasks completed</p>
        </div>
      )}
    </div>
  );
}
