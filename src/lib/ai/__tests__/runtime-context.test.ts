import { describe, it, expect } from 'vitest';
import { describeRuntime, shouldLoadPersona } from '@lib/ai/runtime-context';

describe('runtime-context', () => {
  describe('shouldLoadPersona', () => {
    it('loads persona for chat-page', () => {
      expect(shouldLoadPersona('chat-page')).toBe(true);
    });

    it('skips persona for roast-widget', () => {
      expect(shouldLoadPersona('roast-widget')).toBe(false);
    });
  });

  describe('describeRuntime — chat-page', () => {
    it('sets first-person voice', () => {
      const out = describeRuntime({ surface: 'chat-page', hostPath: '/chat' });
      expect(out).toContain('Chat Page');
      expect(out).toContain('First-person');
      expect(out).toContain('speaking AS Tomer');
    });

    it('never assumes visitor is Tomer', () => {
      const out = describeRuntime({ surface: 'chat-page', hostPath: '/chat' });
      expect(out).toContain('Never assume');
    });

    it('describes the /chat page layout', () => {
      const out = describeRuntime({ surface: 'chat-page', hostPath: '/chat' });
      expect(out).toContain('3-column');
      expect(out).toContain('Spectrum slider');
      expect(out).toContain('Matrix rain');
    });

    it('encourages markdown output', () => {
      const out = describeRuntime({ surface: 'chat-page', hostPath: '/chat' });
      expect(out).toContain('markdown');
      expect(out).toContain('open_link');
    });

    it('falls back for unknown paths', () => {
      const out = describeRuntime({ surface: 'chat-page', hostPath: '/mystery' });
      expect(out).toContain('Chat Page');
      expect(out).toContain('exact layout is unknown');
    });
  });

  describe('describeRuntime — roast-widget', () => {
    it('sets Grok voice (third-person, NOT Cybernus)', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 0 });
      expect(out).toContain('Roast Widget');
      expect(out).toContain('You are Grok');
      expect(out).toContain('NOT Cybernus');
      expect(out).toContain('Roast HIM');
    });

    it('never assumes visitor identity', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 0 });
      expect(out).toContain('Could be anyone');
    });

    it('describes the homepage sections', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 0 });
      expect(out).toContain('Contribution Graph');
      expect(out).toContain('Featured Projects');
      expect(out).toContain('Celery Organization');
    });

    it('level 0 = first roast, short teaser', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 0 });
      expect(out).toContain('0/3');
      expect(out).toContain('first roast');
    });

    it('level 2 = escalation, references prior roasts', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 2 });
      expect(out).toContain('2/3');
      expect(out).toContain('already got 2 roasts');
      expect(out).toContain("don't repeat");
    });

    it('defaults roastLevel to 0 when omitted', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/' });
      expect(out).toContain('0/3');
    });

    it('grounds roast in real facts', () => {
      const out = describeRuntime({ surface: 'roast-widget', hostPath: '/', roastLevel: 0 });
      expect(out).toContain('Facts hurt more than lies');
    });
  });
});
