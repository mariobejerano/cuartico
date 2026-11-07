/**
 * Configuración que llega en tiempo de build desde variables `VITE_*` (Vite las sustituye al compilar).
 * Equivale a un `@ConfigurationProperties` de Spring: un único sitio donde se leen.
 */
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined

export const env = {
  /** URL base de la API sin barra final, p. ej. `http://localhost:8080`. */
  apiBaseUrl: (raw || (import.meta.env.DEV ? 'http://localhost:8080' : '')).replace(/\/+$/, ''),
}
