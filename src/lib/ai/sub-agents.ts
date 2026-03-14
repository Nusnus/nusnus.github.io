/**
 * Sub-agent system — visual task decomposition for complex queries.
 *
 * When Cybernus processes a complex request, it can spawn "sub-agents"
 * that appear in the side panel, giving users visibility into the
 * thinking process. This is primarily a UI/UX feature — the actual
 * processing happens in the main Grok context.
 */

/** Possible states for a sub-agent task. */
export type SubAgentStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A single sub-agent task. */
export interface SubAgentTask {
  id: string;
  /** Short label for the task (e.g., "Searching GitHub data"). */
  label: string;
  /** Optional detail text shown below the label. */
  detail?: string;
  /** Current status. */
  status: SubAgentStatus;
  /** Timestamp when the task started. */
  startedAt: number;
  /** Timestamp when the task completed/failed. */
  completedAt?: number;
  /** Optional result summary. */
  result?: string;
  /** Icon identifier for the task type. */
  icon: SubAgentIcon;
}

/** Icon types for different sub-agent task categories. */
export type SubAgentIcon = 'search' | 'data' | 'analyze' | 'render' | 'web' | 'memory' | 'guard';

/**
 * Generate sub-agent tasks based on the user's message content.
 * These are created before the API call to show the thinking process.
 */
export function generateSubAgentTasks(userMessage: string): SubAgentTask[] {
  const lower = userMessage.toLowerCase();
  const tasks: SubAgentTask[] = [];
  const now = Date.now();

  // Always start with context loading
  tasks.push({
    id: crypto.randomUUID(),
    label: 'Loading context',
    detail: 'Injecting live GitHub data + knowledge base',
    status: 'pending',
    startedAt: now,
    icon: 'data',
  });

  // Check for visualization requests
  if (/visual|chart|graph|diagram|show me|mermaid|draw|picture|image/i.test(lower)) {
    tasks.push({
      id: crypto.randomUUID(),
      label: 'Preparing visuals',
      detail: 'Generating dynamic visual components',
      status: 'pending',
      startedAt: now,
      icon: 'render',
    });
  }

  // Check for data analysis requests
  if (/stats|statistics|contribution|commit|pr|review|activity|data/i.test(lower)) {
    tasks.push({
      id: crypto.randomUUID(),
      label: 'Analyzing GitHub data',
      detail: 'Processing contribution metrics',
      status: 'pending',
      startedAt: now,
      icon: 'analyze',
    });
  }

  // Check for web search triggers
  if (
    /search|find|look up|latest|news|recent|linkedin|twitter|career|history/i.test(lower) ||
    /previous (company|job|role|work)/i.test(lower)
  ) {
    tasks.push({
      id: crypto.randomUUID(),
      label: 'Web search',
      detail: 'Searching for external information',
      status: 'pending',
      startedAt: now,
      icon: 'web',
    });
  }

  // Check for memory/history references
  if (/remember|earlier|before|last time|previous|you said|you mentioned/i.test(lower)) {
    tasks.push({
      id: crypto.randomUUID(),
      label: 'Checking memory',
      detail: 'Reviewing conversation context',
      status: 'pending',
      startedAt: now,
      icon: 'memory',
    });
  }

  // Always end with response generation
  tasks.push({
    id: crypto.randomUUID(),
    label: 'Generating response',
    detail: 'Streaming from Grok 4',
    status: 'pending',
    startedAt: now,
    icon: 'search',
  });

  return tasks;
}

/**
 * Advance sub-agent tasks through their lifecycle.
 * Returns updated tasks with the next pending task set to running.
 */
export function advanceSubAgentTasks(tasks: SubAgentTask[]): SubAgentTask[] {
  const updated = [...tasks];
  const firstPending = updated.findIndex((t) => t.status === 'pending');
  const currentRunning = updated.findIndex((t) => t.status === 'running');

  // Complete the currently running task
  if (currentRunning >= 0) {
    const task = updated[currentRunning];
    if (task) {
      updated[currentRunning] = {
        ...task,
        status: 'completed',
        completedAt: Date.now(),
      };
    }
  }

  // Start the next pending task
  if (firstPending >= 0) {
    const task = updated[firstPending];
    if (task) {
      updated[firstPending] = { ...task, status: 'running' };
    }
  }

  return updated;
}

/**
 * Complete all remaining sub-agent tasks.
 */
export function completeAllSubAgentTasks(tasks: SubAgentTask[]): SubAgentTask[] {
  return tasks.map((t) =>
    t.status === 'completed' ? t : { ...t, status: 'completed' as const, completedAt: Date.now() },
  );
}
