/**
 * @file The live indicator beside the activity panel's heading: a light that
 * is grey until the first refresh answers, green while the data is live, and
 * amber while some of it could not be refreshed and the page shows older
 * data. The default export is the live island.
 */

import type { Freshness } from "./live-data-store.ts";

import {
  type StatusDisplay,
  StatusLight,
} from "../../design-system/StatusLight.tsx";
import { tw } from "../../design-system/tailwind.ts";
import { liveIsland } from "./live-island.tsx";

const FRESHNESS_DISPLAYS = {
  baked: {
    colorClass: tw`bg-status-inactive`,
    text: "Showing data from when the page was built",
  },
  live: { colorClass: tw`bg-status-active`, text: "Live" },
  stale: {
    colorClass: tw`bg-status-warning`,
    text: "Live data unavailable, showing older data",
  },
} as const satisfies Record<Freshness, StatusDisplay>;

export function LiveIndicator({ freshness }: { freshness: Freshness }) {
  const { colorClass, text } = FRESHNESS_DISPLAYS[freshness];
  return (
    <StatusLight
      colorClass={colorClass}
      pulses={false}
      sizeClass={tw`h-2 w-2`}
      text={text}
    />
  );
}

export default liveIsland(LiveIndicator, ({ freshness }) => ({ freshness }));
