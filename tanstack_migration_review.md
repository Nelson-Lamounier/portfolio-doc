# TanStack Start Migration — Detailed Code Review

## Executive Summary

The migration from Next.js to TanStack Start is **largely functional** but contains several leftover Next.js artefacts, structural gaps, TypeScript issues, and deviations from TanStack best practices that should be resolved before the application is considered fully migrated.

---

## 1. Leftover Next.js Artefacts (Critical)

### 1.1 `.eslintrc.json` — Wrong ESLint Config

**File:** [.eslintrc.json](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/.eslintrc.json)

```diff
- { "extends": "next/core-web-vitals" }
+ { "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"] }
```

The project still extends `next/core-web-vitals`, which requires `eslint-config-next` as a dependency. This package is not installed (correctly so), meaning **ESLint will fail** on any `eslint` run. This must be replaced with a framework-agnostic config.

---

### 1.2 `.gitignore` — Next.js Artefacts Still Listed

**File:** [.gitignore](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/.gitignore) (Lines 11–16)

```diff
- # next.js
- /.next/
- /out/
- # production
- /build
+ # TanStack / Vite
+ /dist/
```

The `.next/` and `/out/` paths are Next.js-specific. The Vite/TanStack build output is `/dist/`, which **is not currently ignored**. This is a significant oversight: the `/dist` folder will be committed to source control.

Additionally, `next-env.d.ts` on line 35 is a Next.js-generated file and no longer relevant:
```diff
- next-env.d.ts
```

---

### 1.3 `markdoc/tags.jsx` — Next.js ESLint Disable Comment

**File:** [src/markdoc/tags.jsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/markdoc/tags.jsx) (Line 26)

```jsx
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={src} alt={alt} />
```

The comment `@next/next/no-img-element` is a Next.js-specific ESLint rule. Remove it entirely — it is meaningless in a Vite/TanStack project and will produce a warning with any non-Next ESLint config.

**Fix:** Remove the comment. Optionally replace `<img>` with a proper component if lazy loading is needed.

---

### 1.4 `providers.tsx` — `'use client'` Directive

**File:** [src/providers.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/providers.tsx) (Line 1)

```diff
- 'use client'
```

`'use client'` is a **Next.js / React Server Components** directive. It has **no effect** in TanStack Start and should be removed from all files that contain it. TanStack Start handles client/server boundaries differently, via `createServerFn` and route-level SSR configuration.

**Affected files with `'use client'`:**
- `src/providers.tsx` (L1)
- `src/components/Layout.tsx` (L1)
- `src/components/Search.tsx` (L1)
- `src/components/MobileNavigation.tsx` (L1)
- `src/components/TableOfContents.tsx` (L1)
- `src/components/DocsHeader.tsx` (L1)
- `src/components/PrevNextLinks.tsx` (L1)
- `src/components/Fence.tsx` (L1)

> [!WARNING]
> These directives are harmless noise in Vite/TanStack but are misleading and violate clean migration standards. Every single one should be removed.

---

### 1.5 `package.json` — Stale Package Name

**File:** [package.json](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/package.json) (Line 2)

```json
"name": "tailwind-plus-syntax"
```

This is clearly the original Tailwind template package name, **not the portfolio-doc project name**. It should be updated to reflect the actual application:

```json
"name": "portfolio-doc"
```

---

## 2. TypeScript & Configuration Issues

### 2.1 `tsconfig.json` — Missing TanStack-Required Fields

**File:** [tsconfig.json](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/tsconfig.json)

TanStack Start requires `verbatimModuleSyntax` for proper ESM handling and benefits from `customConditions` for SSR resolution. The current config is also missing `types` for the global `React` namespace.

```diff
  "compilerOptions": {
    "target": "es6",
+   "verbatimModuleSyntax": true,
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
+   "types": ["vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
+ "exclude": ["node_modules", "dist"]
```

> [!NOTE]
> The `exclude` currently only lists `node_modules`. The `dist` output directory should also be excluded to prevent TypeScript from type-checking build artefacts.

---

### 2.2 `shims/async_hooks.ts` — Use of `any`

**File:** [src/shims/async_hooks.ts](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/shims/async_hooks.ts) (Line 6)

```typescript
run(store: any, callback: () => void) {
```

Violates the project-wide `no any` rule. Should be typed generically:

```typescript
run<T>(store: T, callback: () => unknown): unknown {
```

---

### 2.3 `markdoc/nodes.js` — Plain JavaScript in a TypeScript Project

**File:** [src/markdoc/nodes.js](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/markdoc/nodes.js)

This file is `.js`, which requires `allowJs: true` in `tsconfig.json` (currently set) but provides no type safety. Per your global project standards, **all files must be TypeScript**. Similarly, `markdoc/tags.jsx` should be `tags.tsx`.

> [!IMPORTANT]
> `nodes.js` → `nodes.ts` and `tags.jsx` → `tags.tsx` should be renamed for consistency and type safety.

---

### 2.4 `markdoc/search.mjs` — Mixed Module Extension

**File:** [src/markdoc/search.mjs](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/markdoc/search.mjs)

`.mjs` is a valid ESM extension but inconsistent with the rest of the codebase. Since `"type": "module"` is set in `package.json`, all `.js` files are already treated as ESM. The `.mjs` extension is redundant here and the corresponding `types.d.ts` module declaration uses the `.mjs` path, creating a coupling that is fragile. Convert to `.ts` for type safety.

---

## 3. TanStack Router / Start Best-Practice Gaps

### 3.1 `routeTree.gen.ts` — Manually Extended With Non-Generated Code

**File:** [src/routeTree.gen.ts](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/routeTree.gen.ts) (Lines 79–86)

```typescript
import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
```

> [!CAUTION]
> `routeTree.gen.ts` is **auto-generated** by TanStack Router and will be **overwritten** on the next `vite dev` or `tsr generate`. Any manually added code here will be lost. Move the `Register` declaration augmentation to `router.tsx` or a dedicated `src/types/tanstack.d.ts` file.

---

### 3.2 `router.tsx` — `getRouter` Export Is an Alias Anti-Pattern

**File:** [src/router.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/router.tsx) (Line 19)

```typescript
export const getRouter = createRouter
```

This alias export exists only to give `routeTree.gen.ts` something to import for the `Register` type, but since it's in the auto-generated file (see 3.1), this alias becomes the *source of* the fragility. Remove `getRouter` once the `Register` augmentation is moved to the correct location.

---

### 3.3 `router.tsx` — Missing `defaultPreload` and `defaultStaleTime`

**File:** [src/router.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/router.tsx)

TanStack Start best practice for SSR apps recommends setting `defaultPreload` and `defaultStaleTime` in the router to prevent unnecessary re-fetches on navigation:

```typescript
const router = createTanStackRouter({
  routeTree,
  scrollRestoration: true,
+ defaultPreload: 'intent',
+ defaultStaleTime: 5_000,
})
```

---

### 3.4 `routes/docs.$id.tsx` — Shallow URL Parameter Matching Is Fragile

**File:** [src/routes/docs.$id.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/routes/docs.$id.tsx) (Line 20)

```typescript
const fileKey = `/src/docs/${id}/page.md`
```

The route is `/docs/$id`, which means `id` catches a **single path segment**. A URL like `/docs/my-doc` maps to `id = 'my-doc'` and resolves `fileKey = '/src/docs/my-doc/page.md'`. However the navigation links use flat slugs like `understanding-caching`, which means this works.

The concern is that URLs with **sub-paths** (e.g., `/docs/api/some-endpoint`) would silently 404 with no meaningful error. Consider using a **splat route** (`docs.$.tsx`) for deeper nesting, or validating `id` format early.

Also, the route file and navigation data are decoupled — a typo in `navigation.ts` will silently 404 rather than a build error. Consider co-locating route paths in a shared constant.

---

### 3.5 `routes/__root.tsx` — `<Scripts />` Outside `<body>`

**File:** [src/routes/__root.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/routes/__root.tsx) (Lines 64)

`<Scripts />` is correctly placed at the end of `<body>`. ✅ However, there is missing a `defaultNotFoundComponent` in the root route configuration. The `not-found.tsx` file exists but **is never wired up**:

```typescript
// src/routes/__root.tsx
import NotFound from '../not-found'

export const Route = createRootRoute({
+ defaultNotFoundComponent: NotFound,
  head: () => ({ ... }),
  component: RootComponent,
})
```

Without this, navigating to an unknown route will render a blank screen rather than the custom 404 page.

---

### 3.6 `routes/index.tsx` — No `loader` for SSR Data

**File:** [src/routes/index.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/routes/index.tsx)

The markdown content is accessed via `import.meta.glob` with `eager: true`, which works but is a client-side bundle technique. For a TanStack Start SSR app, the canonical pattern is to put data fetching in a `loader`:

```typescript
export const Route = createFileRoute('/')(({
  loader: async () => {
    // data resolution belongs in the loader for SSR
  },
  component: IndexPageComponent,
})
```

Using `eager: true` glob imports means the **entire docs corpus is shipped in the client bundle**. For larger doc sites, this becomes a performance problem. Loaders allow the data to be fetched on the server and streamed to the client.

---

## 4. Structural / File Organisation Issues

### 4.1 Duplicate Async Hooks Implementations

There are **two separate async hooks shim implementations** with no clear separation of concern:

| File | Purpose |
|------|---------|
| `src/polyfills/async_hooks.js` | Browser polyfill, mapped via Vite alias `node:async_hooks` |
| `src/shims/async_hooks.ts` | TypeScript shim, not referenced from `vite.config.ts` |

The `src/shims/` directory appears to be unused leftover code — the Vite config only maps `node:async_hooks` to `src/polyfills/async_hooks.js`. The `shims/` directory should be removed or its contents consolidated into `polyfills/`.

---

### 4.2 `not-found.tsx` at `src/not-found.tsx`

**File:** [src/not-found.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/not-found.tsx)

This file uses a Next.js naming convention (`not-found.tsx` at the root of `src/`). In TanStack Router, 404 handling is via `defaultNotFoundComponent` on the root route (see gap 3.5). This file should be moved to `src/components/NotFound.tsx` or `src/routes/not-found.tsx` and registered properly.

---

### 4.3 `src/page.md` at the Root of `src/`

**File:** `src/page.md`

This is named following Next.js's `page.tsx` convention. In TanStack Start this file has no framework significance — it's just a static asset loaded by the glob import. The name is fine *functionally*, but it is misleading. Consider renaming to `src/index.md` or `src/docs/index/page.md` for clarity.

---

### 4.4 No `src/routes/_layout` Route for Docs (Layout Route Gap)

All doc routes currently inherit the `Layout` component via `__root.tsx`. This means the Layout (header + sidebar) is always rendered. The Hero section is conditionally shown with:

```typescript
// Layout.tsx
let isHomePage = pathname === '/'
{isHomePage && <Hero />}
```

TanStack Router's idiomatic approach for this would be **layout routes**: a `_layout.tsx` wrapping docs routes and a separate index layout. This eliminates the `pathname === '/'` check and makes the layout tree composable and type-safe.

---

## 5. Minor Issues & Typos

### 5.1 `Search.tsx` — ESLint Suppress Comment for `any`

**File:** [src/components/Search.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/components/Search.tsx) (Line 21)

```typescript
const createAutocomplete = pkg?.createAutocomplete ?? (pkg as any)?.default?.createAutocomplete
```

This uses `as any` to work around an export shape mismatch. Per project standards, use `unknown` and narrow the type:

```typescript
const pkgAny = pkg as unknown as { default?: { createAutocomplete: typeof pkg.createAutocomplete } }
const createAutocomplete = pkg?.createAutocomplete ?? pkgAny?.default?.createAutocomplete
```

---

### 5.2 `vite.config.ts` — `@ts-ignore` Comment

**File:** [vite.config.ts](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/vite.config.ts) (Line 11)

```typescript
// @ts-ignore: async_hooks is injected by our alias and polyfills but fails strict TS check
```

`@ts-ignore` suppresses all errors on the next line, which is broad. Prefer `@ts-expect-error` with a description so TypeScript will flag it if the error is ever resolved, preventing stale suppressions.

---

### 5.3 `MobileNavigation.tsx` — Double `useLocation` Calls

**File:** [src/components/MobileNavigation.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/components/MobileNavigation.tsx) (Lines 41–42)

```typescript
let pathname = useLocation().pathname
let searchParams = useLocation().search
```

`useLocation()` is called **twice**. Call it once and destructure:

```typescript
const { pathname, search: searchParams } = useLocation()
```

---

### 5.4 `Layout.tsx` — `let` Should Be `const` Throughout

**File:** [src/components/Layout.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/components/Layout.tsx) (Lines 23, 68)

The pattern `let [isScrolled, setIsScrolled]` and `let pathname` use `let` where `const` is correct (neither is reassigned). This pattern is consistent across many component files. While not a bug, it should be standardised to `const` for consistency with TypeScript best practices.

---

### 5.5 `Hero.tsx` — `<img>` Tags Missing `loading="lazy"`

**File:** [src/components/Hero.tsx](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/src/components/Hero.tsx) (Lines 40–46, 68–74, 75–81)

The three `<img>` elements (blur-cyan and blur-indigo) are decorative background images above the fold. They should use `loading="lazy"` unless they are explicitly above the fold and critical for LCP. Additionally, empty `alt=""` is correct for decorative images ✅, but `fetchPriority="high"` should be considered for the first image.

---

### 5.6 `package.json` — `start` Script Points to `vite preview`

**File:** [package.json](file:///Users/nelsonlamounier/Desktop/portfolio/portfolio-doc/package.json) (Line 8)

```json
"start": "vite preview"
```

For a TanStack Start SSR app, `vite preview` serves the **static pre-rendered build**, not the SSR server. The correct production start command should be the Node.js server that TanStack Start generates (typically `node dist/server/index.js` or similar). Verify the actual build output and update accordingly.

---

## 6. Summary Table

| Severity | Category | File(s) | Issue |
|----------|----------|---------|-------|
| 🔴 Critical | Leftover artefact | `.eslintrc.json` | `next/core-web-vitals` ESLint config — ESLint will crash |
| 🔴 Critical | Leftover artefact | `.gitignore` | `/dist` not ignored; `.next/` irrelevant |
| 🔴 Critical | TanStack gap | `routeTree.gen.ts` L79–86 | Manual code in auto-generated file — will be overwritten |
| 🔴 Critical | TanStack gap | `__root.tsx` | `defaultNotFoundComponent` not wired up |
| 🟠 High | Leftover artefact | 8 component files | `'use client'` directives with no effect |
| 🟠 High | Leftover artefact | `tags.jsx` L26 | `@next/next/no-img-element` ESLint comment |
| 🟠 High | TypeScript | `shims/async_hooks.ts` L6 | `any` usage — violates project standards |
| 🟠 High | TypeScript | `markdoc/nodes.js`, `tags.jsx` | Plain JS files in a TypeScript project |
| 🟡 Medium | Structural | `src/shims/` directory | Unused duplicate of `src/polyfills/` |
| 🟡 Medium | TanStack gap | `router.tsx` L19 | `getRouter` alias is fragile and misleading |
| 🟡 Medium | TanStack gap | `routes/index.tsx` | No loader; eager glob bloats client bundle |
| 🟡 Medium | TanStack gap | Layout.tsx + routes | No layout routes; pathname check is anti-pattern |
| 🟡 Medium | Config | `tsconfig.json` | Missing `verbatimModuleSyntax`, `types`, wrong `exclude` |
| 🟡 Medium | Config | `package.json` L2 | Stale package name (`tailwind-plus-syntax`) |
| 🟡 Medium | Config | `package.json` L8 | `start` script uses `vite preview` (wrong for SSR) |
| 🔵 Low | Style | `vite.config.ts` L11 | `@ts-ignore` should be `@ts-expect-error` |
| 🔵 Low | Style | `MobileNavigation.tsx` L41–42 | Double `useLocation()` call |
| 🔵 Low | Style | Multiple files | `let` instead of `const` for non-reassigned variables |
| 🔵 Low | Performance | `Hero.tsx` | `<img>` tags missing `loading="lazy"` |
