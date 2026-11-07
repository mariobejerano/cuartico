import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { session } from './session'

/**
 * Arranca la sesión una vez al montar la app (como un `@PostConstruct`):
 * escucha el logout de otras pestañas (CA-20) y comprueba la sesión guardada (CA-11).
 * Al quedar anónimo, vacía la caché de datos para no enseñar datos del usuario anterior.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const stopListening = session.listenToOtherTabs()
    const stopWatching = session.subscribe(() => {
      if (session.getState().status === 'anonymous') queryClient.clear()
    })
    void session.bootstrapOnce()
    return () => {
      stopListening()
      stopWatching()
    }
  }, [queryClient])

  return children
}
