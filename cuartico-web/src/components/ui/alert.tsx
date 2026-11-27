import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Aviso (shadcn/ui, design system v0.2 §7.14): fondo `-bg` del estado, `rounded-lg`, icono + título + texto.
 *   <Alert variant="warning"><CloudOff /><AlertTitle>…</AlertTitle><AlertDescription>…</AlertDescription></Alert>
 * Si el primer hijo es un icono SVG, la rejilla le deja una columna de 20 px.
 *
 * Rol (como el Alert actual de `components/Alert.tsx`): `danger` → `role="alert"` (se anuncia ya);
 * el resto → `role="status"` (se anuncia sin interrumpir). Se puede cambiar con la prop `role`.
 */
const alertVariants = cva(
  [
    'grid gap-x-3 gap-y-1 rounded-lg px-4 py-3 text-sm',
    'has-[>svg]:grid-cols-[1.25rem_1fr] [&>svg]:size-5 [&>svg]:translate-y-px [&>svg]:text-current',
  ],
  {
    variants: {
      variant: {
        info: 'bg-info-bg text-info-fg',
        success: 'bg-success-bg text-success-fg',
        warning: 'bg-warning-bg text-warning-fg',
        danger: 'bg-danger-bg text-danger-fg',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

type AlertProps = ComponentProps<'div'> & VariantProps<typeof alertVariants>

function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role={role ?? (variant === 'danger' ? 'alert' : 'status')}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="alert-title" className={cn('col-start-2 font-semibold', className)} {...props} />
}

function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('col-start-2 grid gap-2', className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components -- las variantes pueden dar el aspecto a otro elemento
export { Alert, AlertDescription, AlertTitle, alertVariants }
