import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Badge (shadcn/ui, design system v0.2 §7.6): píldora de 13 px y 500, fondo `-bg` y texto `-fg` de cada estado.
 * Los de ESTADO llevan un punto de 6 px en `currentColor` delante del texto; el texto siempre está (el color es refuerzo).
 * `brand` es informativo («N variantes», «Tipo: Ropa»): sin punto.
 *
 * Mapeos aprobados: producto Activo → success, Inactivo → neutral; pedido PENDING → warning, CONFIRMED → info,
 * IN_TRANSIT → transit, DELIVERED → success, CANCELLED → neutral; pago UNPAID → danger, PARTIALLY_PAID → warning, PAID → success.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-px text-[0.8125rem] leading-normal font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'bg-success-bg text-success-fg',
        warning: 'bg-warning-bg text-warning-fg',
        danger: 'bg-danger-bg text-danger-fg',
        info: 'bg-info-bg text-info-fg',
        transit: 'bg-transit-bg text-transit-fg',
        neutral: 'bg-neutral-bg text-neutral-fg',
        brand: 'bg-brand-subtle text-brand-subtle-foreground',
      },
      dot: {
        true: "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        false: '',
      },
    },
    defaultVariants: { variant: 'neutral', dot: true },
  },
)

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, dot, ...props }: BadgeProps) {
  const withDot = dot ?? variant !== 'brand'
  return <span data-slot="badge" className={cn(badgeVariants({ variant, dot: withDot }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components -- las variantes sirven para dar el aspecto a otro elemento
export { Badge, badgeVariants }
