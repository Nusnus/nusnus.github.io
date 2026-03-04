import type { ReactNode } from 'react';

/** Centered layout wrapper used by loading / error / checking states. */
export function CenterCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center text-center">{children}</div>
    </div>
  );
}
