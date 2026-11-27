import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '../app/AppProviders'
import { routes } from '../app/routes'
import { createQueryClient } from '../app/wiring'

/** Monta la app completa en una ruta concreta, con un router en memoria (sin barra de direcciones). Mismos providers que App. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient()
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, queryClient, ...utils }
}
