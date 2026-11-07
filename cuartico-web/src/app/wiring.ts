import { QueryClient } from '@tanstack/react-query'
import { configureClient } from '../api/client'
import { session } from '../auth/session'
import { tokens } from '../auth/tokens'
import i18n from '../i18n'

/**
 * "Configuración de beans": conecta las piezas independientes entre sí, una sola vez al arrancar.
 * El cliente HTTP no importa ni i18n ni la sesión: se las damos aquí.
 */
export function wireApiClient() {
  configureClient({
    getLanguage: () => i18n.language || 'es',
    getAccessToken: tokens.getAccess,
    renewAccessToken: session.renewAccessToken,
  })
}

/**
 * Caché de datos de la API (TanStack Query). Con red lenta preferimos no reintentar solos
 * (el cliente ya espera hasta 90 s) ni recargar al volver a la pestaña: el usuario pulsa «Reintentar».
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  })
}
