import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

/**
 * Client-side hydration entry point.
 *
 * TanStack Start's `StartClient` picks up the router context from the
 * server-rendered payload automatically — no `router` prop is needed here.
 * The `startTransition` wrapper keeps hydration from blocking user input.
 */
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
