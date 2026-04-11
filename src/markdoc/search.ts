import FlexSearch from 'flexsearch'
import { slugifyWithCounter } from '@sindresorhus/slugify'

const slugify = slugifyWithCounter()

/**
 * Raw markdown content for all doc pages, resolved at build time.
 * Using lazy imports (no `eager: true`) minimises the initial bundle.
 */
const rawDocs = import.meta.glob('/src/docs/**/*.md', {
  query: '?raw',
  import: 'default',
})
const rootMd = import.meta.glob('/src/page.md', {
  query: '?raw',
  import: 'default',
})

/** A single content section extracted from a markdown document. */
type Section = [title: string, hash: string | null, paragraphs: string[]]

/**
 * Parses a raw markdown string into an array of sections using
 * a lightweight regex-based approach (no AST required for search indexing).
 *
 * @param md - Raw markdown string.
 * @returns Ordered list of `[title, anchorHash, paragraphs]` tuples.
 */
function extractSectionsRegex(md: string): Section[] {
  slugify.reset()

  const titleMatch = md.match(/^title:\s*(.*?)\s*$/m)
  const title = titleMatch ? titleMatch[1] : ''
  const sections: Section[] = [[title, null, []]]

  const body = md.replace(/^---[\s\S]*?^---/m, '')
  const blocks = body.split(/\n\s*\n/)

  for (const rawBlock of blocks) {
    const block = rawBlock.trim()
    if (!block) continue

    const headingMatch = block.match(/^(#{1,2})\s+(.+)$/m)
    if (headingMatch) {
      const content = headingMatch[2]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`*_]/g, '')
      const hash = slugify(content)
      sections.push([content, hash, []])
    } else {
      const content = block
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`*_]/g, '')
      sections.at(-1)![2].push(content)
    }
  }

  return sections
}

/** The FlexSearch document index used for full-text section search. */
const sectionIndex = new FlexSearch.Document({
  tokenize: 'full',
  document: {
    id: 'url',
    index: 'content',
    store: ['title', 'pageTitle'],
  },
  context: {
    resolution: 9,
    depth: 2,
    bidirectional: true,
  },
})

/** Populated search result item. */
export interface Result {
  url: string
  title: string
  pageTitle?: string
  /** Index signature required by Algolia Autocomplete's BaseItem constraint. */
  [key: string]: unknown
}

/**
 * Builds the FlexSearch index from all markdown files.
 * Called once on module load (lazy import ensures this runs after hydration).
 */
async function buildIndex(): Promise<void> {
  const allEntries: Record<string, () => Promise<unknown>> = {
    ...rawDocs,
    ...rootMd,
  }

  await Promise.all(
    Object.entries(allEntries).map(async ([path, load]) => {
      const md = (await load()) as string
      const url =
        path === '/src/page.md'
          ? '/'
          : path.replace('/src/docs', '/docs').replace('/page.md', '')

      const sections = extractSectionsRegex(md)

      for (const [title, hash, content] of sections) {
        sectionIndex.add({
          url: url + (hash ? '#' + hash : ''),
          title,
          content: [title, ...content].join('\n'),
          pageTitle: hash ? sections[0][0] : '',
        })
      }
    }),
  )
}

/** Index build promise — ensures it only runs once. */
const indexReady = buildIndex()

/**
 * Searches the FlexSearch index for sections matching the query.
 *
 * @param query - The search string entered by the user.
 * @param options - Optional FlexSearch search options.
 * @returns Array of matching result objects.
 */
export async function search(
  query: string,
  options: Record<string, unknown> = {},
): Promise<Result[]> {
  await indexReady

  // FlexSearch.Document.searchAsync returns a promise
  const results = await sectionIndex.searchAsync(query, { ...options, enrich: true })
  if (!results.length) return []

  const [first] = results
  if (!first?.result?.length) return []

  return first.result.map((item) => {
    const doc = item.doc as { title?: string; pageTitle?: string }
    return {
      url: String(item.id),
      title: doc.title ?? '',
      pageTitle: doc.pageTitle,
    }
  })
}
