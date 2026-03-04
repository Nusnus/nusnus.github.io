/**
 * MermaidBlock — renders a Mermaid diagram definition as an inline SVG.
 *
 * Uses dynamic import so the ~300KB mermaid library is only loaded when
 * the AI actually produces a diagram. Renders are sandboxed per-block
 * using unique IDs to avoid collisions when multiple diagrams appear.
 */
import { useEffect, useRef, useState } from 'react';

let mermaidInitialized = false;

/** Lazily load + initialize mermaid once. */
async function getMermaid() {
  const { default: mermaid } = await import('mermaid');
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#6d9e37',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#6d9e37',
        lineColor: '#888',
        secondaryColor: '#2a2a2a',
        tertiaryColor: '#1a1a1a',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '13px',
      },
      flowchart: { curve: 'basis', padding: 12 },
      securityLevel: 'loose',
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

/** Strip emojis and other non-BMP characters that break Mermaid's parser. */
function sanitize(src: string): string {
  return Array.from(src)
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp >= 0x1f000 && cp <= 0x1ffff) return false;
      if (cp >= 0x2600 && cp <= 0x27bf) return false;
      if (cp >= 0xfe00 && cp <= 0xfe0f) return false;
      if (cp === 0x200d) return false;
      return true;
    })
    .join('');
}

let blockCounter = 0;

export default function MermaidBlock({ code, blockKey }: { code: string; blockKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const idRef = useRef(`mermaid-${blockKey}-${++blockCounter}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = await getMermaid();
        // Sanitize emojis/special chars that break Mermaid's parser,
        // then render directly (skip parse() which is overly strict).
        const clean = sanitize(code);
        const { svg } = await mermaid.render(idRef.current, clean);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.removeAttribute('height');
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
          setRendering(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setRendering(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="bg-bg-elevated my-2 rounded-lg p-3 text-xs">
        <div className="text-status-error mb-1 font-medium">⚠ Diagram error</div>
        <pre className="text-text-muted whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated my-2 overflow-x-auto rounded-lg p-3">
      {rendering && (
        <div className="text-text-muted flex items-center gap-2 text-xs">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Rendering diagram…
        </div>
      )}
      <div ref={containerRef} className="flex justify-center [&_svg]:max-w-full" />
    </div>
  );
}
