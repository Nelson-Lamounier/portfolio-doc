import { useLocation } from '@tanstack/react-router'

import { navigation } from '@/lib/navigation'

export function DocsHeader({ title }: { title?: string }) {
  let pathname = useLocation().pathname
  let section = navigation.find((section) =>
    section.links.find((link) => link.href === pathname),
  )

  if (!title && !section) {
    return null
  }

  return (
    <header className="mb-9 space-y-1">
      {section && (
        <p className="font-display text-sm font-medium text-teal-500">
          {section.title}
        </p>
      )}
      {title && (
        <h1 className="font-display text-3xl tracking-tight text-zinc-900 dark:text-white">
          {title}
        </h1>
      )}
    </header>
  )
}
