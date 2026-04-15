import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Markdoc from '@markdoc/markdoc'

import markdocTags from '@/markdoc/tags'

/**
 * Statically-declared glob for the root page markdown.
 * Using lazy import (no `eager: true`) keeps it out of the initial bundle.
 */
const rootMd = import.meta.glob('/src/page.md', {
  query: '?raw',
  import: 'default',
})

/** Shared Markdoc transform config. */
const markdocConfig = {
  tags: markdocTags,
} as unknown as Parameters<typeof Markdoc.transform>[1]

export const Route = createFileRoute('/_home/')({
  /**
   * Server-side (and SSR-capable) loader for the index page.
   *
   * Imports and parses the root `page.md` before the component renders,
   * keeping markdown parsing off the client's critical render path.
   *
   * @returns Object containing the pre-transformed Markdoc renderable tree.
   */
  async loader() {
    const loader = rootMd['/src/page.md']

    if (!loader) {
      return { rawMarkdown: null }
    }

    const rawMarkdown = (await loader()) as string

    return { rawMarkdown }
  },
  component: IndexPageComponent,
})

/** Renders the pre-transformed Markdoc tree returned by the route loader. */
function IndexPageComponent() {
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

  const ast = Markdoc.parse(rawMarkdown)
  const transformed = Markdoc.transform(ast, markdocConfig)
  const content = Markdoc.renderers.react(transformed, React)
  return <>{content}</>
}
