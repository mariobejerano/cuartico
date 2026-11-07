import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '../auth/AuthProvider'
import { createQueryClient } from './wiring'
import { routes } from './routes'

const router = createBrowserRouter(routes)

/**
 * Componente raíz. Los "Provider" son como el ApplicationContext de Spring:
 * ponen algo (la caché de datos, la sesión, el router) a disposición de todos los componentes de debajo.
 */
export function App({ queryClient }: { queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
