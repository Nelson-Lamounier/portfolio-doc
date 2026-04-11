import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout route for the index path `/`.
 *
 * The Hero section is now handled by the root Layout component for the home page.
 */
export const Route = createFileRoute('/_home')({
  component: HomeLayout,
})

function HomeLayout() {
  return <Outlet />
}
