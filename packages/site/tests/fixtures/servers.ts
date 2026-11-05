/**
 * @file The local servers the smoke tests run against: the site's preview, on
 * Astro preview's default port unless PREVIEW_PORT names another, so checks
 * in several checkouts can run at once, and the worker replay it bakes and
 * refreshes from, a fixed offset above it; and what makes text a port.
 */

/** A server on this machine: the port it listens on, and its URL. */
export interface LocalServer {
  readonly port: number;
  readonly url: string;
}

// Astro preview's default port, which Playwright must know to reach the
// preview: https://docs.astro.build/en/reference/cli-reference/#--port-number
const ASTRO_PREVIEW_PORT = 4321;
// Clear of the preview ports other checkouts pick.
const WORKER_REPLAY_OFFSET = 1000;
export const HIGHEST_PORT = 65_535;

export const { preview: PREVIEW, workerReplay: WORKER_REPLAY } = smokeServers(
  process.env["PREVIEW_PORT"],
);

export function smokeServers(previewPortSetting: string | undefined): {
  preview: LocalServer;
  workerReplay: LocalServer;
} {
  const previewPort = parsePreviewPort(previewPortSetting);
  return {
    preview: localServer(previewPort),
    workerReplay: localServer(previewPort + WORKER_REPLAY_OFFSET),
  };
}

function parsePreviewPort(setting: string | undefined): number {
  if (setting === undefined) {
    return ASTRO_PREVIEW_PORT;
  }
  const highest = HIGHEST_PORT - WORKER_REPLAY_OFFSET;
  if (!isPort(setting, highest)) {
    throw new Error(
      `PREVIEW_PORT must be a port from 1 to ${String(highest)}, so the worker replay's, ${String(WORKER_REPLAY_OFFSET)} above it, is a port too; got "${setting}". Set it to a free port in that range, or unset it to use ${String(ASTRO_PREVIEW_PORT)}.`,
    );
  }
  return Number(setting);
}

export function isPort(text: string, highest: number): boolean {
  return /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= highest;
}

function localServer(port: number): LocalServer {
  return { port, url: `http://localhost:${String(port)}` };
}
