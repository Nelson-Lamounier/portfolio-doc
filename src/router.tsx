import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

/**
 * Creates and configures the application's TanStack Router instance.
 *
 * @returns Configured router instance with SSR, intent-based preloading,
 *   stale-time caching, and scroll restoration enabled.
 */
export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultStaleTime: 5_000,
  })

  return router
}

// Register the router type globally for full type-safety across the app.
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}

// Register the router with TanStack Start for SSR awareness.
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof createRouter>>
  }
}

/**
 * Alias required by `@tanstack/start-client-core` internals.
 * The TanStack Start bundler plugin resolves the `#tanstack-router-entry`
 * virtual module to this file and imports `getRouter` from it.
 */
export const getRouter = createRouter
