import type { ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'info' | 'success' | 'warning' | 'danger'

interface AlertProps {
  variant: Variant
  title?: ReactNode
  children?: ReactNode
  /** Botón opcional (p. ej. «Reintentar»). */
  action?: ReactNode
}

/**
 * Aviso del design system (§7). Los errores usan `role="alert"` (se anuncian ya);
 * el resto `role="status"` (se anuncian sin interrumpir). HU-01 CA-27.
 */
export function Alert({ variant, title, children, action }: AlertProps) {
  return (
    <div className={`c-alert c-alert--${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon name={variant === 'danger' ? 'alert' : variant === 'success' ? 'check' : 'info'} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
        {action}
      </div>
    </div>
  )
}
