import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from './AppProviders'
import { createQueryClient } from './wiring'
import { routes } from './routes'

const router = createBrowserRouter(routes)

/** Componente raíz: los providers comunes (`AppProviders`) y el router que usa la barra de direcciones del navegador. */
export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <AppProviders queryClient={client}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
