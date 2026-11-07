/**
 * Dónde viven los tokens (ADR-001):
 * - access token: SOLO en memoria (esta variable). Se pierde al recargar, y es lo que queremos.
 * - refresh token: en `localStorage`, para sobrevivir a recargas y pestañas nuevas.
 * Nunca se escriben en la consola, en la URL ni en mensajes de error (CA-18).
 */
export const REFRESH_KEY = 'cuartico.refreshToken'

let accessToken: string | null = null

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null // modo privado muy estricto: sin almacenamiento, la sesión dura lo que la pestaña
  }
}

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (value: string | null) => {
    accessToken = value
  },
  /** Leer SIEMPRE de aquí (nunca guardar una copia en memoria): otra pestaña puede haberlo rotado. */
  getRefresh: () => storage()?.getItem(REFRESH_KEY) ?? null,
  setRefresh: (value: string) => storage()?.setItem(REFRESH_KEY, value),
  clear: () => {
    accessToken = null
    storage()?.removeItem(REFRESH_KEY)
  },
}
