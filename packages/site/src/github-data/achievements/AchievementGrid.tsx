/**
 * @file The achievement grid: Tomer's achievements under their caption, each a
 * tile, and one with a page behind it a link that lifts on hover. The default
 * export is the live island.
 */

import type { GitHubSnapshot } from "../snapshot/snapshot.ts";

import { Caption } from "../../design-system/Caption.tsx";
import { linkTarget } from "../../design-system/link-target.ts";
import { tw } from "../../design-system/tailwind.ts";
import { liveIsland } from "../live/live-island.tsx";
import { achievements } from "./achievements.ts";

const ACHIEVEMENT_CLASS = tw`flex flex-col items-center rounded-lg bg-bg-surface/50 p-3 text-center ring-1 ring-border/40`;

const LINKED_ACHIEVEMENT_CLASS = tw`${ACHIEVEMENT_CLASS} cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:ring-accent/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0`;

export function AchievementGrid({ snapshot }: { snapshot: GitHubSnapshot }) {
  return (
    <div className="mt-6">
      <Caption className="mb-3">Achievements</Caption>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {achievements(snapshot).map(({ detail, emoji, link, title, value }) => {
          const content = (
            <>
              <span aria-hidden="true" className="mb-1 text-2xl">
                {emoji}
              </span>
              <p className="font-mono text-lg leading-tight font-bold text-accent">
                {value}
              </p>
              <p className="text-xs font-medium text-text-primary">{title}</p>
              <p className="text-[10px] text-text-muted">{detail}</p>
            </>
          );
          return link === undefined ? (
            <div className={ACHIEVEMENT_CLASS} key={title}>
              {content}
            </div>
          ) : (
            <a
              className={LINKED_ACHIEVEMENT_CLASS}
              href={link}
              key={title}
              {...linkTarget(link)}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default liveIsland(AchievementGrid, ({ snapshot }) => ({ snapshot }));
