import { CSPProvider } from '@base-ui/react/csp-provider'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from '../auth/AuthProvider'

/**
 * Los "Provider" de toda la app, en UN solo sitio: los usan `App.tsx` (producción) y `test/renderApp.tsx` (tests).
 * Son como el ApplicationContext de Spring: ponen algo (la caché de datos, la sesión) a disposición de todos los
 * componentes de debajo. Al compartirlos, los tests ejercitan exactamente la misma configuración que producción.
 *
 * `CSPProvider disableStyleElements` (ADR-004): ningún componente de Base UI crea elementos `<style>` (los bloquearía
 * nuestra CSP `style-src 'self'`); los estilos que pondrían ahí van en nuestro CSS. Lo vigila `AppProviders.test.tsx`.
 */
export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </CSPProvider>
  )
}
