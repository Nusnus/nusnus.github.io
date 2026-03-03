/**
 * Web Worker for WebLLM inference.
 *
 * Runs the LLM engine in a dedicated thread so the main UI thread stays
 * responsive during model loading and token generation.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
