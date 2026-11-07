/**
 * Contador de peticiones "lentas" (más de 5 s sin respuesta, HU-01 CA-8).
 * Es un pequeño almacén observable sin React: la UI se suscribe con `useSyncExternalStore`
 * para mostrar «El servidor se está despertando…». Al no depender de React, sirve igual en React Native.
 */
type Listener = () => void

let slowCount = 0
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((l) => l())
}

export const netStatus = {
  /** Marca una petición como lenta. Devuelve la función para desmarcarla (se llama una sola vez). */
  markSlow(): () => void {
    slowCount++
    emit()
    let done = false
    return () => {
      if (done) return
      done = true
      slowCount--
      emit()
    }
  },
  isWaking: () => slowCount > 0,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
