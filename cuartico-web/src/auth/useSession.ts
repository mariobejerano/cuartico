import { useSyncExternalStore } from 'react'
import { session, type SessionState } from './session'

/** Estado de la sesión dentro de un componente. Se vuelve a pintar solo cuando cambia. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState)
}

/** Usuario autenticado, o `null`. */
export function useCurrentUser() {
  const state = useSession()
  return state.status === 'authenticated' ? state.user : null
}
