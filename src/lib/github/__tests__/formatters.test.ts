import { describe, it, expect } from 'vitest';
import {
  formatEventType,
  getEventColor,
  truncateCommitMessage,
  getActivityLevel,
} from '@lib/github/formatters';

describe('formatEventType', () => {
  it('maps known event types to friendly labels', () => {
    expect(formatEventType('PushEvent')).toBe('Pushed');
    expect(formatEventType('PullRequestReviewEvent')).toBe('Reviewed');
    expect(formatEventType('WatchEvent')).toBe('Starred');
  });

  it('falls back to stripping the "Event" suffix for unknown types', () => {
    expect(formatEventType('GollumEvent')).toBe('Gollum');
    expect(formatEventType('Custom')).toBe('Custom');
  });
});

describe('getEventColor', () => {
  it('returns a mapped color for known types', () => {
    expect(getEventColor('PushEvent')).toBe('text-accent');
    expect(getEventColor('DeleteEvent')).toBe('text-red-400');
  });

  it('returns the default color for unknown types', () => {
    expect(getEventColor('MysteryEvent')).toBe('text-text-secondary');
  });
});

describe('truncateCommitMessage', () => {
  it('keeps short single-line messages intact', () => {
    expect(truncateCommitMessage('fix: small bug')).toBe('fix: small bug');
  });

  it('uses only the first line of a multi-line message', () => {
    expect(truncateCommitMessage('feat: thing\n\nlong body here')).toBe('feat: thing');
  });

  it('truncates long messages with an ellipsis at the boundary', () => {
    const msg = 'a'.repeat(100);
    const out = truncateCommitMessage(msg, 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('getActivityLevel', () => {
  it('returns 0 for no contributions', () => {
    expect(getActivityLevel(0)).toBe(0);
  });

  it('buckets counts into ascending heatmap levels', () => {
    expect(getActivityLevel(1)).toBe(1);
    expect(getActivityLevel(3)).toBe(1);
    expect(getActivityLevel(6)).toBe(2);
    expect(getActivityLevel(10)).toBe(3);
    expect(getActivityLevel(11)).toBe(4);
    expect(getActivityLevel(1000)).toBe(4);
  });
});
