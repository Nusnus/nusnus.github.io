/**
 * @file The worker replay, which the smoke tests start as Playwright's web
 * server: it serves the recorded worker replies on the port its argument
 * names.
 *
 * Usage: node tests/fixtures/worker/replay/main.ts <port>
 */

import { createServer } from "node:http";

import { answerReplayRequest, parsePort } from "./server.ts";

createServer(answerReplayRequest).listen(parsePort(process.argv[2]));
