import { createRootRoute, Outlet, Scripts, HeadContent } from '@tanstack/react-router'
import clsx from 'clsx'

import { Providers } from '../providers'
import { Layout } from '../components/Layout'
import NotFound from '../not-found'

import '../styles/tailwind.css'

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'CacheAdvance - Never miss the cache again.',
      },
      {
        name: 'description',
        content: 'Cache every single thing your app could ever do ahead of time, so your code never even has to run at all.',
      }
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Lexend:wght@400..700&display=swap',
      }
    ]
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" className={clsx('h-full antialiased')} suppressHydrationWarning>
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-inter: 'Inter', sans-serif;
            --font-lexend: 'Lexend', sans-serif;
          }
        `}} />
      </head>
      <body className="flex min-h-full bg-zinc-50 dark:bg-black font-sans">
        <Providers>
          <Layout>
            <Outlet />
          </Layout>
        </Providers>
        <Scripts />
      </body>
    </html>
  )
}
