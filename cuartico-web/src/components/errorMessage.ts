import { isApiError } from '../api/errors'

/**
 * Qué mensaje mostrar para un error. Guardamos CLAVES de traducción (o el `detail` que ya viene traducido
 * de la API), nunca el texto final: así, si el usuario cambia de idioma, el mensaje se vuelve a traducir.
 */
export interface UiMessage {
  titleKey?: string
  bodyKey?: string
  /** `detail` de la API (ya traducido por el backend). */
  text?: string
  /** Mostrar «Reintentar». */
  retry: boolean
}

export function messageForError(error: unknown): UiMessage {
  if (!isApiError(error) || error.kind === 'network') {
    return { titleKey: 'net.unreachable_title', bodyKey: 'net.unreachable_body', retry: true } // CA-9
  }
  if (error.kind === 'session_ended') {
    return { bodyKey: 'session.ended', retry: false } // CA-15
  }
  const isServerError = (error.status ?? 0) >= 500
  if (error.detail) return { text: error.detail, retry: isServerError } // CA-10, CA-17, CA-23
  return { bodyKey: 'net.unexpected_generic', retry: true } // CA-10: nunca JSON crudo ni trazas
}
