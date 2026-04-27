/**
 * useLiveData — Custom hook for subscribing to live data CustomEvents.
 *
 * Eliminates the duplicated useEffect pattern that was previously
 * copy-pasted across ContributionGraph, ContributionLineChart, and ActivityGraph.
 *
 * Reads `window.__liveData[eventName]` synchronously on mount so that widgets
 * which hydrate AFTER `LiveData` has already dispatched its event (typical for
 * `client:visible` islands below the fold) still pick up the latest payload.
 */

import { useEffect, useRef, useState } from 'react';
import { readStash } from '@lib/live-cache';

/**
 * Subscribe to a CustomEvent dispatched on `window` and extract data from it.
 *
 * The selector is stored in a ref so consumers don't need to worry about
 * memoizing it — the effect won't re-subscribe on selector identity changes.
 *
 * @param eventName - The event name to listen for (e.g. 'live-data:contributions')
 * @param selector - Function to extract the desired data from the event detail
 * @returns The latest data from the event, or `undefined` if no event received yet
 */
export function useLiveData<TDetail, TResult>(
  eventName: string,
  selector: (detail: TDetail) => TResult | undefined,
): TResult | undefined {
  const selectorRef = useRef(selector);

  // Initialise from the synchronous stash so late-hydrating widgets pick up
  // any payload that LiveData already published before this hook mounted.
  const [data, setData] = useState<TResult | undefined>(() => {
    const stashed = readStash<TDetail>(eventName);
    return stashed === undefined ? undefined : selector(stashed);
  });

  useEffect(() => {
    selectorRef.current = selector;
  });

  useEffect(() => {
    function onLiveData(e: Event) {
      const detail = (e as CustomEvent<TDetail>).detail;
      const result = selectorRef.current(detail);
      if (result !== undefined) {
        setData(result);
      }
    }

    // Re-check the stash when the event name changes — there may already be
    // a payload published for this new event.
    const stashed = readStash<TDetail>(eventName);
    if (stashed !== undefined) {
      const result = selectorRef.current(stashed);
      if (result !== undefined) setData(result);
    }

    window.addEventListener(eventName, onLiveData);
    return () => window.removeEventListener(eventName, onLiveData);
  }, [eventName]);

  return data;
}
