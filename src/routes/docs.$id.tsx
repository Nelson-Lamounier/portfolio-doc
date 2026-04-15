import { createFileRoute, notFound } from '@tanstack/react-router'
import React from 'react'
import Markdoc from '@markdoc/markdoc'

import markdocNodes from '@/markdoc/nodes'
import markdocTags from '@/markdoc/tags'

/**
 * Statically-imported markdown modules, resolved at build time by Vite.
 * Using `lazy: false` (the Vite default without `eager`) keeps these out of the
 * initial client bundle; they are only fetched when a route loader runs.
 */
const rawDocs = import.meta.glob('/src/docs/**/*.md', {
  query: '?raw',
  import: 'default',
})

/** Shared Markdoc transform config. */
const markdocConfig = {
  nodes: markdocNodes,
  tags: markdocTags,
} as unknown as Parameters<typeof Markdoc.transform>[1]

export const Route = createFileRoute('/docs/$id')({
  /**
   * Server-side (and SSR-capable) loader for the docs page.
   *
   * Dynamically imports the markdown file for the given route param,
   * ensuring the content is resolved before the component renders —
   * no loading state or fallback required in the component tree.
   *
   * @param context - TanStack route context containing route params.
   * @throws notFound() when the markdown file does not exist for the given id.
   */
  async loader({ params }) {
    const fileKey = `/src/docs/${params.id}/page.md`
    const loader = rawDocs[fileKey]

    if (!loader) {
      throw notFound()
    }

    const rawMarkdown = (await loader()) as string

    return { rawMarkdown }
  },
  component: DocPageComponent,
})

/** Renders the pre-transformed Markdoc tree returned by the route loader. */
function DocPageComponent() {
  const { rawMarkdown } = Route.useLoaderData()

  if (!rawMarkdown) {
    return (
      <div className="flex h-full items-center justify-center pt-32">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
          Page not found
        </h1>
      </div>
    )
  }

  try {
    const ast = Markdoc.parse(rawMarkdown)
    const transformed = Markdoc.transform(ast, markdocConfig)
    const content = Markdoc.renderers.react(transformed, React)
    return <>{content}</>
  } catch (error) {
    console.error('Error parsing markdown:', error)
    return (
      <div className="flex h-full items-center justify-center pt-32">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
          Error loading page
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }
}
