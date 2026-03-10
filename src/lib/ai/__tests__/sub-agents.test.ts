import { describe, it, expect } from 'vitest';
import {
  generateSubAgentTasks,
  advanceSubAgentTasks,
  completeAllSubAgentTasks,
} from '@lib/ai/sub-agents';

describe('generateSubAgentTasks', () => {
  it('always includes context loading and response generation tasks', () => {
    const tasks = generateSubAgentTasks('hello');
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks[0]?.label).toBe('Loading context');
    expect(tasks[tasks.length - 1]?.label).toBe('Generating response');
  });

  it('adds visualization task for chart-related queries', () => {
    const tasks = generateSubAgentTasks('Show me a chart of contributions');
    const visualTask = tasks.find((t) => t.label === 'Preparing visuals');
    expect(visualTask).toBeDefined();
    expect(visualTask?.icon).toBe('render');
  });

  it('adds data analysis task for stats-related queries', () => {
    const tasks = generateSubAgentTasks('What are the contribution stats?');
    const dataTask = tasks.find((t) => t.label === 'Analyzing GitHub data');
    expect(dataTask).toBeDefined();
    expect(dataTask?.icon).toBe('analyze');
  });

  it('adds web search task for search-related queries', () => {
    const tasks = generateSubAgentTasks('Search for the latest news');
    const searchTask = tasks.find((t) => t.label === 'Web search');
    expect(searchTask).toBeDefined();
    expect(searchTask?.icon).toBe('web');
  });

  it('adds memory task for history-related queries', () => {
    const tasks = generateSubAgentTasks('Do you remember what you said earlier?');
    const memTask = tasks.find((t) => t.label === 'Checking memory');
    expect(memTask).toBeDefined();
    expect(memTask?.icon).toBe('memory');
  });

  it('generates unique IDs for all tasks', () => {
    const tasks = generateSubAgentTasks('Show me stats and search for info');
    const ids = tasks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('creates all tasks with pending status', () => {
    const tasks = generateSubAgentTasks('Do something complex with charts and data');
    expect(tasks.every((t) => t.status === 'pending')).toBe(true);
  });
});

describe('advanceSubAgentTasks', () => {
  it('starts the first pending task', () => {
    const tasks = generateSubAgentTasks('hello');
    const advanced = advanceSubAgentTasks(tasks);
    expect(advanced[0]?.status).toBe('running');
  });

  it('completes running task and starts next pending', () => {
    const tasks = generateSubAgentTasks('hello');
    let current = advanceSubAgentTasks(tasks);
    // First task is now running
    expect(current[0]?.status).toBe('running');

    // Advance again — first task completes, second starts
    current = advanceSubAgentTasks(current);
    expect(current[0]?.status).toBe('completed');
    expect(current[0]?.completedAt).toBeDefined();
  });

  it('preserves already completed tasks', () => {
    const tasks = generateSubAgentTasks('hello');
    let current = tasks;
    // Advance through all tasks
    for (let i = 0; i < tasks.length + 1; i++) {
      current = advanceSubAgentTasks(current);
    }
    const completedCount = current.filter((t) => t.status === 'completed').length;
    expect(completedCount).toBeGreaterThan(0);
  });
});

describe('completeAllSubAgentTasks', () => {
  it('marks all tasks as completed', () => {
    const tasks = generateSubAgentTasks('test query with visualization');
    const completed = completeAllSubAgentTasks(tasks);
    expect(completed.every((t) => t.status === 'completed')).toBe(true);
    expect(completed.every((t) => t.completedAt !== undefined)).toBe(true);
  });

  it('preserves already completed tasks without overwriting', () => {
    const tasks = generateSubAgentTasks('hello');
    let current = advanceSubAgentTasks(tasks);
    current = advanceSubAgentTasks(current);
    // First task should be completed already
    const firstCompletedAt = current[0]?.completedAt;

    const allCompleted = completeAllSubAgentTasks(current);
    expect(allCompleted[0]?.completedAt).toBe(firstCompletedAt);
  });
});
