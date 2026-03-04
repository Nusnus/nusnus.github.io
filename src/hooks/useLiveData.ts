/**
 * useLiveData — Custom hook for subscribing to live data CustomEvents.
 *
 * Eliminates the duplicated useEffect pattern that was previously
 * copy-pasted across ContributionGraph, ContributionLineChart, and ActivityGraph.
 */

import { useEffect, useState } from 'react';

/**
 * Subscribe to a CustomEvent dispatched on `window` and extract data from it.
 *
 * @param eventName - The event name to listen for (e.g. 'live-data:contributions')
 * @param selector - Function to extract the desired data from the event detail
 * @returns The latest data from the event, or `undefined` if no event received yet
 */
export function useLiveData<TDetail, TResult>(
  eventName: string,
  selector: (detail: TDetail) => TResult | undefined,
): TResult | undefined {
  const [data, setData] = useState<TResult | undefined>(undefined);

  useEffect(() => {
    function onLiveData(e: Event) {
      const detail = (e as CustomEvent<TDetail>).detail;
      const result = selector(detail);
      if (result !== undefined) {
        setData(result);
      }
    }

    window.addEventListener(eventName, onLiveData);
    return () => window.removeEventListener(eventName, onLiveData);
  }, [eventName, selector]);

  return data;
}
