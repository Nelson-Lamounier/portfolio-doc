import { useEffect, useId, useRef } from 'react'
import { useTheme } from 'next-themes'

/**
 * Renders a Mermaid diagram from raw diagram source text.
 *
 * - Runs entirely client-side via useEffect (mermaid.js uses DOM APIs).
 * - Dynamically imports mermaid to avoid SSR bundle impact.
 * - Re-renders automatically when the colour theme changes (light ↔ dark).
 * - Shows a subtle placeholder while the diagram is loading.
 */
export function MermaidDiagram({ code }: { code: string }) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  // useId gives a stable, unique id per component instance.
  // Replace colons (invalid in SVG element IDs) with underscores.
  const rawId = useId()
  const diagramId = `mermaid_${rawId.replace(/[^a-zA-Z0-9]/g, '_')}`

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Dynamic import keeps mermaid out of the SSR bundle entirely.
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      })

      mermaid
        .render(diagramId, code)
        .then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg
            // Make the SVG responsive
            const svgEl = containerRef.current.querySelector('svg')
            if (svgEl) {
              svgEl.removeAttribute('width')
              svgEl.removeAttribute('height')
              svgEl.setAttribute('width', '100%')
            }
          }
        })
        .catch((err) => {
          console.error('[MermaidDiagram] render error:', err)
          if (containerRef.current) {
            containerRef.current.innerHTML = `<pre class="text-red-500 text-sm p-2">Diagram error: ${String(err)}</pre>`
          }
        })
    })
  }, [code, diagramId, resolvedTheme])

  return (
    <div
      ref={containerRef}
      className="mermaid my-6 overflow-x-auto rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/60 [&_svg]:mx-auto"
      aria-label="Diagram"
    >
      {/* SSR / loading placeholder */}
      <div className="h-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )
}
