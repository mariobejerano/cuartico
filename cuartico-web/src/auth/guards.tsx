import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import type { Role } from '../api/types'
import { loginPathFor, safeRedirect } from './redirect'
import { hasRole } from './roles'
import { CheckingSession, SessionUnreachable } from './SessionScreens'
import { useSession } from './useSession'

/**
 * Guarda de rutas privadas: como un filtro de Spring Security que exige estar autenticado.
 * Sin sesión, manda al login recordando a dónde iba (CA-6), salvo tras un «Cerrar sesión».
 */
export function RequireAuth() {
  const state = useSession()
  const location = useLocation()

  if (state.status === 'loading') return <CheckingSession />
  if (state.status === 'unreachable') return <SessionUnreachable error={state.error} />
  if (state.status === 'anonymous') {
    const to = state.reason === 'logout' ? '/login' : loginPathFor(location.pathname + location.search)
    return <Navigate to={to} replace />
  }
  return <Outlet />
}

/** Solo para quien NO tiene sesión (el login). Con sesión, va al inicio o a la ruta pedida (CA-5, CA-6). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const state = useSession()
  const [params] = useSearchParams()

  if (state.status === 'loading') return <CheckingSession />
  if (state.status === 'unreachable') return <SessionUnreachable error={state.error} />
  if (state.status === 'authenticated') {
    return <Navigate to={safeRedirect(params.get('redirect')) ?? '/'} replace />
  }
  return children
}

/**
 * Guarda por rol (CA-25): como `@PreAuthorize("hasRole('ADMIN')")`, pero solo para la interfaz.
 * Con `children` envuelve un trozo de pantalla (lo oculta); sin `children` protege rutas hijas.
 */
export function RequireRole({ roles, children, fallback }: { roles: Role[]; children?: ReactNode; fallback?: ReactNode }) {
  const state = useSession()
  const user = state.status === 'authenticated' ? state.user : null
  // Con `fallback`, quien no tiene el rol ve eso en su lugar (p. ej. «No tienes acceso», HU-15 CA-25).
  if (!hasRole(user, ...roles)) return fallback ?? (children ? null : <Navigate to="/" replace />)
  return children ?? <Outlet />
}
