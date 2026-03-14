/**
 * Tests for `src/lib/cybernus/context.ts` — the runtime-environment prompt block.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCybernusContext } from '@lib/cybernus/context';

describe('buildCybernusContext — runtime environment block', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes all four promised fields (page, surface, viewport, language)', async () => {
    const out = await buildCybernusContext({
      spectrum: 50,
      pathname: '/chat',
      viewport: 'desktop',
      surface: 'chat-page',
      language: 'en',
    });
    expect(out).toContain('## Runtime Environment');
    expect(out).toContain('**Page:** `/chat`');
    expect(out).toContain('**Surface:**');
    expect(out).toContain('**Viewport:**');
    expect(out).toContain('**UI language:**');
  });

  it('describes desktop viewport with wide-content hints', async () => {
    const out = await buildCybernusContext({
      spectrum: 50,
      pathname: '/chat',
      viewport: 'desktop',
      surface: 'chat-page',
      language: 'en',
    });
    expect(out).toContain('Desktop');
    expect(out).toContain('tables');
  });

  it('describes mobile viewport with narrow-content hints', async () => {
    const out = await buildCybernusContext({
      spectrum: 50,
      pathname: '/chat',
      viewport: 'mobile',
      surface: 'chat-page',
      language: 'en',
    });
    expect(out).toContain('Mobile');
    expect(out).toContain('narrow');
  });

  it('describes chat-page surface differently from roast-widget', async () => {
    const chat = await buildCybernusContext({
      spectrum: 50,
      pathname: '/chat',
      viewport: 'desktop',
      surface: 'chat-page',
      language: 'en',
    });
    const roast = await buildCybernusContext({
      spectrum: 50,
      pathname: '/',
      viewport: 'desktop',
      surface: 'roast-widget',
      language: 'en',
    });
    expect(chat).toContain('Full-screen Cybernus chat page');
    expect(roast).toContain('Roast Widget');
    expect(roast).toContain('punchy');
  });

  it('describes Spanish with the Cali Colombia register', async () => {
    const out = await buildCybernusContext({
      spectrum: 50,
      pathname: '/chat',
      viewport: 'desktop',
      surface: 'chat-page',
      language: 'es',
    });
    expect(out).toContain('Spanish');
    expect(out).toContain('Cali');
    expect(out).toContain('parce');
  });

  it('includes the spectrum block after the runtime block', async () => {
    const out = await buildCybernusContext({
      spectrum: 94,
      pathname: '/chat',
      viewport: 'desktop',
      surface: 'chat-page',
      language: 'en',
    });
    const runtimeIdx = out.indexOf('## Runtime Environment');
    const spectrumIdx = out.indexOf('## Current Spectrum Setting');
    expect(runtimeIdx).toBeGreaterThan(-1);
    expect(spectrumIdx).toBeGreaterThan(runtimeIdx);
    expect(out).toContain('**94%**');
    expect(out).toContain('Unhinged');
  });
});
