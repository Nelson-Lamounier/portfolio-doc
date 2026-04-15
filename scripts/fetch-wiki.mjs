#!/usr/bin/env node
/**
 * fetch-wiki.mjs
 *
 * Pre-build script: downloads transformed wiki pages from S3 and writes them
 * into src/docs/{slug}/page.md so Vite's import.meta.glob picks them up at
 * build time.
 *
 * Also downloads the navigation manifest to scripts/wiki-manifest.json for
 * use by generate-navigation.mjs.
 *
 * Required env vars:
 *   WIKI_S3_BUCKET    S3 bucket name
 *   AWS_REGION        AWS region (falls back to AWS_DEFAULT_REGION or us-east-1)
 *
 * Optional:
 *   WIKI_LOCAL_DIR    If set, copies from a local wiki directory instead of S3
 *                     (useful for local dev without AWS: WIKI_LOCAL_DIR=../reasearch-brain/kowledge-base/wiki)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const ROOT        = path.resolve(__dirname, '..')
const DOCS_DIR    = path.join(ROOT, 'src', 'docs')
const MANIFEST    = path.join(__dirname, 'wiki-manifest.json')

const BUCKET      = process.env.WIKI_S3_BUCKET
const REGION      = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
const LOCAL_DIR   = process.env.WIKI_LOCAL_DIR   // optional local override
const PREFIX      = 'portfolio-docs'

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg)    { console.log(`  ${msg}`) }
function logOk(msg)  { console.log(`  ✓ ${msg}`) }
function logErr(msg) { console.error(`  ✗ ${msg}`) }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function writeDocPage(slug, content) {
  const dir = path.join(DOCS_DIR, slug)
  ensureDir(dir)
  fs.writeFileSync(path.join(dir, 'page.md'), content, 'utf8')
}

/**
 * Convert a relative wiki path to a URL slug.
 * e.g. "tools/argocd.md"           → "tools-argocd"
 *      "ai-engineering/chatbot.md"  → "ai-engineering-chatbot"
 */
function pathToSlug(relPath) {
  return relPath.replace(/\.md$/, '').replace(/[/\\]/g, '-')
}

/**
 * Build a basename → path-slug lookup for bare wikilinks (e.g. [[argocd]]).
 * If two files share a basename (collision), the entry is set to null so callers
 * know to fall back to a best-effort or prompt an error.
 */
function buildSlugMap(pages, wikiDir) {
  const map = new Map()
  for (const pagePath of pages) {
    const relPath  = path.relative(wikiDir, pagePath)
    const slug     = pathToSlug(relPath)
    const basename = path.basename(pagePath, '.md')
    if (map.has(basename)) {
      map.set(basename, null)   // collision — ambiguous bare name
    } else {
      map.set(basename, slug)
    }
  }
  return map
}

// ── S3 path: list objects under portfolio-docs/ ───────────────────────────

function s3List() {
  const result = execSync(
    `aws s3api list-objects-v2 \
      --bucket ${BUCKET} \
      --prefix "${PREFIX}/" \
      --query "Contents[].Key" \
      --output json \
      --region ${REGION}`,
    { encoding: 'utf8' }
  )
  return JSON.parse(result || '[]')
}

function s3Get(key) {
  return execSync(
    `aws s3 cp "s3://${BUCKET}/${key}" - --region ${REGION}`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
}

async function fetchFromS3() {
  if (!BUCKET) {
    console.error('ERROR: WIKI_S3_BUCKET env var is required.')
    console.error('       For local dev, set WIKI_LOCAL_DIR=../path/to/wiki instead.')
    process.exit(1)
  }

  log(`Fetching wiki pages from s3://${BUCKET}/${PREFIX}/`)

  const keys = s3List().filter(k => k !== `${PREFIX}/`)
  log(`Found ${keys.length} objects`)

  let fetched = 0
  let errors  = 0

  for (const key of keys) {
    const basename = path.basename(key)           // e.g. argocd.md or manifest.json

    if (basename === 'manifest.json') {
      // Save manifest for generate-navigation.mjs
      const content = s3Get(key)
      fs.writeFileSync(MANIFEST, content, 'utf8')
      logOk(`manifest.json → scripts/wiki-manifest.json`)
      continue
    }

    if (!basename.endsWith('.md')) continue

    // Derive path-based slug from key, e.g.:
    //   "portfolio-docs/tools/argocd.md"          → "tools-argocd"
    //   "portfolio-docs/ai-engineering/chatbot.md" → "ai-engineering-chatbot"
    const relKey = key.slice(`${PREFIX}/`.length)
    const slug   = pathToSlug(relKey)
    try {
      const content = s3Get(key)
      writeDocPage(slug, content)
      logOk(`${slug}`)
      fetched++
    } catch (err) {
      logErr(`Failed to fetch ${key}: ${err.message}`)
      errors++
    }
  }

  return { fetched, errors }
}

// ── Local path: copy from local wiki directory ────────────────────────────

function copyFrontmatter(fm, body) {
  // Add nextjs.metadata to wiki frontmatter for local dev pass-through
  // (the sync script does this properly for S3; here we do a best-effort copy)
  const titleMatch = fm.match(/^title:\s*(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
  const firstPara = body.split('\n').find(l => l.trim() && !l.startsWith('#') && l.length > 30) || ''
  // Strip wikilinks from description
  const cleanPara = firstPara.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, t) => t.split('/').pop())
  return `---\ntitle: ${title}\nnextjs:\n  metadata:\n    title: ${title}\n    description: "${cleanPara.slice(0, 150).replace(/"/g, '\\"')}"\n---\n\n`
}

/**
 * Transform Obsidian-style wikilinks to Markdown hrefs.
 *
 * Supported forms:
 *   [[tools/argocd]]          → [argocd](/docs/tools-argocd)
 *   [[argocd]]                → [argocd](/docs/tools-argocd)  (via slugMap)
 *   [[argocd|Argo CD]]        → [Argo CD](/docs/tools-argocd)
 *   [[tools/argocd|Argo CD]]  → [Argo CD](/docs/tools-argocd)
 *
 * @param {string}        content  Raw markdown body
 * @param {Map<string,string|null>} slugMap  basename → path-slug (null = collision)
 */
function transformWikilinks(content, slugMap = new Map()) {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    let target, display
    if (inner.includes('|')) {
      ;[target, display] = inner.split('|', 2)
      display = display.trim()
    } else {
      target  = inner
      display = inner.split('/').pop().trim()
    }
    const trimmed = target.trim()
    let slug
    if (trimmed.includes('/')) {
      // Path-qualified link: replace slashes with dashes
      slug = trimmed.replace(/\//g, '-')
    } else {
      // Bare name: resolve via slugMap; fall back to the bare name itself
      const resolved = slugMap.get(trimmed)
      slug = (resolved != null) ? resolved : trimmed
    }
    return `[${display}](/docs/${slug})`
  })
}

function fetchFromLocal() {
  const wikiDir = path.resolve(LOCAL_DIR)
  if (!fs.existsSync(wikiDir)) {
    console.error(`ERROR: WIKI_LOCAL_DIR not found: ${wikiDir}`)
    process.exit(1)
  }

  log(`Copying wiki pages from local: ${wikiDir}`)

  // Recursively find all .md files
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries.flatMap(e =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)
    )
  }

  const pages = walk(wikiDir).filter(f => f.endsWith('.md'))
  log(`Found ${pages.length} pages`)

  // Build basename → path-slug map for bare wikilink resolution
  const slugMap = buildSlugMap(pages, wikiDir)

  // Build manifest from index.md (sibling to wiki/)
  const indexPath = path.join(wikiDir, '..', 'index.md')
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8')
    buildLocalManifest(indexContent, pages.length, slugMap)
  }

  let fetched = 0
  for (const pagePath of pages) {
    const relPath = path.relative(wikiDir, pagePath)
    const slug    = pathToSlug(relPath)   // e.g. "ai-engineering-chatbot"
    let content = fs.readFileSync(pagePath, 'utf8')

    // Strip existing frontmatter
    let body = content
    let fm   = ''
    if (content.startsWith('---')) {
      const end = content.indexOf('\n---', 3)
      if (end !== -1) {
        fm   = content.slice(0, end + 4)
        body = content.slice(end + 4).trim()
      }
    }

    // Transform wikilinks (path-aware) and rebuild frontmatter
    const transformed = transformWikilinks(body, slugMap)
    const newFm       = copyFrontmatter(fm, body)
    writeDocPage(slug, newFm + transformed)
    fetched++
  }

  logOk(`Copied ${fetched} pages`)
  return { fetched, errors: 0 }
}

function buildLocalManifest(indexContent, pageCount, slugMap = new Map()) {
  // Minimal manifest from index.md for local dev
  const sections = []
  let current    = null
  const linkRe   = /^- \[\[([^\]]+)\]\]\s*(?:—\s*(.+))?/

  for (const line of indexContent.split('\n')) {
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      current = { title: h2[1].trim(), links: [] }
      sections.push(current)
      continue
    }
    const lm = line.match(linkRe)
    if (lm && current) {
      const target   = lm[1].trim()
      // Derive slug: path-qualified ([[tools/argocd]]) → "tools-argocd";
      // bare name → look up slugMap, fall back to bare name
      let slug
      if (target.includes('/')) {
        slug = target.replace(/\//g, '-')
      } else {
        const resolved = slugMap.get(target)
        slug = (resolved != null) ? resolved : target
      }
      // Title uses only the basename portion for readability
      const basename = target.split('/').pop()
      const title    = basename.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      current.links.push({
        title,
        href:        `/docs/${slug}`,
        description: (lm[2] || '').trim(),
      })
    }
  }

  const manifest = {
    generated: new Date().toISOString(),
    pageCount,
    sections,
    source: 'local',
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8')
  logOk('manifest.json generated from local index.md')
}

// ── Entry point ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n📥  fetch-wiki: downloading wiki pages\n')

  ensureDir(DOCS_DIR)

  const { fetched, errors } = LOCAL_DIR
    ? fetchFromLocal()
    : await fetchFromS3()

  console.log(`\n  Pages written: ${fetched}`)
  if (errors > 0) {
    console.error(`  Errors:        ${errors}`)
    process.exit(1)
  }
  console.log('  Done.\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
