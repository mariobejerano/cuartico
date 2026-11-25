import { CSPProvider } from '@base-ui/react/csp-provider'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../app/routes'
import { createQueryClient } from '../app/wiring'
import { AuthProvider } from '../auth/AuthProvider'

/** Monta la app completa en una ruta concreta, con un router en memoria (sin barra de direcciones). Mismos providers que App. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient()
  const utils = render(
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </CSPProvider>,
  )
  return { router, queryClient, ...utils }
}
