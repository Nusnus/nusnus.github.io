// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveData } from '@hooks/useLiveData';

/** Helper to dispatch a typed CustomEvent on window. */
function dispatch<T>(eventName: string, detail: T) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

describe('useLiveData', () => {
  it('returns undefined before any event is received', () => {
    const { result } = renderHook(() =>
      useLiveData<{ value: number }, number>('test:event', (d) => d.value),
    );
    expect(result.current).toBeUndefined();
  });

  it('returns data after a matching event is dispatched', () => {
    const { result } = renderHook(() =>
      useLiveData<{ value: number }, number>('test:value', (d) => d.value),
    );

    act(() => dispatch('test:value', { value: 42 }));
    expect(result.current).toBe(42);
  });

  it('updates when a new event arrives', () => {
    const { result } = renderHook(() =>
      useLiveData<{ value: string }, string>('test:update', (d) => d.value),
    );

    act(() => dispatch('test:update', { value: 'first' }));
    expect(result.current).toBe('first');

    act(() => dispatch('test:update', { value: 'second' }));
    expect(result.current).toBe('second');
  });

  it('ignores events with non-matching names', () => {
    const { result } = renderHook(() =>
      useLiveData<{ value: number }, number>('test:target', (d) => d.value),
    );

    act(() => dispatch('test:other', { value: 99 }));
    expect(result.current).toBeUndefined();
  });

  it('ignores events when selector returns undefined', () => {
    const { result } = renderHook(() =>
      useLiveData<{ value: number | null }, number>('test:filter', (d) =>
        d.value !== null ? d.value : undefined,
      ),
    );

    act(() => dispatch('test:filter', { value: null }));
    expect(result.current).toBeUndefined();

    act(() => dispatch('test:filter', { value: 7 }));
    expect(result.current).toBe(7);
  });

  it('unsubscribes on unmount', () => {
    const selector = vi.fn((d: { value: number }) => d.value);
    const { unmount } = renderHook(() =>
      useLiveData<{ value: number }, number>('test:unmount', selector),
    );

    unmount();
    dispatch('test:unmount', { value: 123 });
    // Selector should not have been called after unmount
    // (it may have been called 0 times or during render, but not for the post-unmount event)
    const callCountAtUnmount = selector.mock.calls.length;
    dispatch('test:unmount', { value: 456 });
    expect(selector.mock.calls.length).toBe(callCountAtUnmount);
  });

  it('re-subscribes when eventName changes', () => {
    const { result, rerender } = renderHook(
      ({ eventName }: { eventName: string }) =>
        useLiveData<{ value: number }, number>(eventName, (d) => d.value),
      { initialProps: { eventName: 'test:a' } },
    );

    act(() => dispatch('test:a', { value: 1 }));
    expect(result.current).toBe(1);

    rerender({ eventName: 'test:b' });

    act(() => dispatch('test:a', { value: 2 }));
    // Should not update — no longer listening to test:a (keeps previous value)
    expect(result.current).toBe(1);

    act(() => dispatch('test:b', { value: 3 }));
    expect(result.current).toBe(3);
  });

  it('uses the latest selector without re-subscribing', () => {
    let multiplier = 1;
    const { result, rerender } = renderHook(() =>
      useLiveData<{ value: number }, number>('test:selector', (d) => d.value * multiplier),
    );

    act(() => dispatch('test:selector', { value: 5 }));
    expect(result.current).toBe(5);

    multiplier = 10;
    rerender();

    act(() => dispatch('test:selector', { value: 5 }));
    expect(result.current).toBe(50);
  });
});
