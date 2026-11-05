/**
 * @file Live islands: a component that shows GitHub data, wrapped to render the
 * page's live data and re-render whenever it changes. While React hydrates the
 * island, it renders the initial data, which the server rendered too.
 */

import { type ComponentType, useSyncExternalStore } from "react";

import type { LiveData } from "./live-data-store.ts";

import { pageStore } from "./page-store.ts";

export function liveIsland<Props extends object>(
  Component: ComponentType<Props>,
  select: (data: LiveData) => Props,
) {
  function LiveIsland() {
    const store = pageStore();
    const data = useSyncExternalStore(
      store.subscribe,
      store.read,
      store.readInitial,
    );
    return <Component {...select(data)} />;
  }
  return LiveIsland;
}
