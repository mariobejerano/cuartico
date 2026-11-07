/**
 * Bloqueo entre pestañas con la Web Locks API (ADR-001, HU-01 CA-14).
 * Es como un `synchronized` que abarca todas las pestañas del mismo sitio: mientras una pestaña
 * renueva o cierra sesión, las demás esperan su turno y luego leen el refresh más reciente.
 */
export const REFRESH_LOCK = 'cuartico-refresh'

// Alternativa solo dentro de la pestaña, para entornos sin `navigator.locks` (tests con jsdom,
// navegadores muy antiguos). ADR-001: no se implementa coordinación entre pestañas sin Web Locks.
let tail: Promise<unknown> = Promise.resolve()

export function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task) as Promise<T>
  }
  const run = tail.then(task, task)
  tail = run.catch(() => undefined)
  return run
}
