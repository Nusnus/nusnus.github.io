/**
 * @file The presence dot on the sidebar's avatar: Tomer's presence on GitHub
 * as a status light, pulsing while he was active today or yesterday. The
 * default export is the live island.
 */

import {
  type StatusDisplay,
  StatusLight,
} from "../../../design-system/StatusLight.tsx";
import { tw } from "../../../design-system/tailwind.ts";
import { liveIsland } from "../../live/live-island.tsx";
import { type Presence, presence } from "./presence.ts";

const PRESENCE_DISPLAYS = {
  active: { colorClass: tw`bg-status-active`, text: "Active today" },
  away: { colorClass: tw`bg-status-inactive`, text: "Away" },
  recent: { colorClass: tw`bg-status-warning`, text: "Active yesterday" },
} as const satisfies Record<Presence, StatusDisplay>;

export function PresenceDot({ presence }: { presence: Presence }) {
  const { colorClass, text } = PRESENCE_DISPLAYS[presence];
  return (
    <StatusLight
      colorClass={colorClass}
      pulses={presence !== "away"}
      sizeClass={tw`h-3.5 w-3.5`}
      text={text}
    />
  );
}

export default liveIsland(PresenceDot, ({ clock, snapshot }) => ({
  presence: presence(snapshot.activity.data, clock),
}));
