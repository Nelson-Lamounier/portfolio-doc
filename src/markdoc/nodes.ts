import type { Node, Config, Schema } from '@markdoc/markdoc'
import pkg from '@markdoc/markdoc'
const { Tag, nodes: markdocDefaultNodes } = pkg
import { slugifyWithCounter } from '@sindresorhus/slugify'
import yaml from 'js-yaml'

import { DocsLayout } from '@/components/DocsLayout'
import { Fence } from '@/components/Fence'

/**
 * Per-render slugify counter, keyed by the Markdoc Config instance.
 * A new counter is seeded for each document transform to ensure
 * heading IDs are unique within their document scope.
 */
const documentSlugifyMap = new Map<
  Config,
  ReturnType<typeof slugifyWithCounter>
>()

/* Markdoc's Schema.render is typed as `string` but accepts React components at runtime. */
type LooseSchema = Omit<Schema, 'render'> & { render?: unknown }

const nodes = {
  document: {
    ...markdocDefaultNodes.document,
    render: DocsLayout,
    /**
     * Transforms the document node, seeding a slug counter and
     * forwarding the parsed frontmatter and child nodes to DocsLayout.
     *
     * @param node - The Markdoc document node.
     * @param config - The active Markdoc transform config.
     * @returns A Tag wrapping DocsLayout with frontmatter and children.
     */
    transform(node: Node, config: Config) {
      documentSlugifyMap.set(config, slugifyWithCounter())

      return new Tag(
        DocsLayout as unknown as string,
        {
          frontmatter: yaml.load(
            node.attributes.frontmatter as string,
          ) as Record<string, unknown>,
          nodes: node.children,
        },
        node.transformChildren(config),
      )
    },
  },
  heading: {
    ...markdocDefaultNodes.heading,
    /**
     * Transforms heading nodes by injecting a slugified `id` attribute
     * used for anchor linking and the Table of Contents.
     *
     * @param node - The Markdoc heading node.
     * @param config - The active Markdoc transform config.
     * @returns A Tag for the appropriate heading level with a stable id.
     */
    transform(node: Node, config: Config) {
      const slugify = documentSlugifyMap.get(config)
      const attributes = node.transformAttributes(config) as Record<
        string,
        unknown
      >
      const children = node.transformChildren(config)
      const text = children
        .filter((child): child is string => typeof child === 'string')
        .join(' ')
      const id = (attributes.id as string | undefined) ?? slugify!(text)

      return new Tag(
        `h${node.attributes.level as number}`,
        { ...attributes, id },
        children,
      )
    },
  },
  th: {
    ...markdocDefaultNodes.th,
    attributes: {
      ...markdocDefaultNodes.th.attributes,
      scope: {
        type: String,
        default: 'col',
      },
    },
  },
  fence: {
    render: Fence,
    attributes: {
      language: {
        type: String,
      },
    },
  },
}

export default nodes as Record<string, LooseSchema>
