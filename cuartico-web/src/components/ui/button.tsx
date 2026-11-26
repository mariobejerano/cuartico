import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * Botón de shadcn/ui (estilo base-nova, primitivo de Base UI), adaptado a Cuartico (TT-19, fase 0).
 * Las clases reproducen `.c-btn` de global.css con los mismos tokens de Lienzo, así que se ve igual que los botones
 * aún sin migrar. En la fase 1 los tokens pasan a `@theme` y estas clases se simplifican (`bg-primary`…).
 *
 * Notas de Tailwind v4:
 * - `bg-(--color-…)` es "usa esta variable CSS como valor": no hay colores escritos a mano.
 * - `hover:` solo se aplica en dispositivos con ratón (`@media (hover: hover)`), igual que en global.css.
 * - `enabled:` evita que un botón deshabilitado cambie de color al pasar el ratón o pulsarlo.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-(--space-2) whitespace-nowrap',
    'min-h-(--control-height) px-(--space-4) rounded-(--radius-md)',
    'border-(length:--border-width) border-solid border-transparent',
    '[font-family:inherit] [font-size:inherit] font-(--font-weight-semibold) leading-[1.2] no-underline cursor-pointer',
    'transition-colors duration-(--duration-fast) ease-(--easing-standard)',
    'disabled:cursor-not-allowed disabled:border-transparent',
    'disabled:bg-(--color-action-disabled-bg) disabled:text-(--color-action-disabled-text)',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-(--color-action-primary-bg) text-(--color-action-primary-text)',
          'enabled:hover:bg-(--color-action-primary-bg-hover) enabled:active:bg-(--color-action-primary-bg-active)',
        ],
        secondary: [
          'bg-(--color-action-secondary-bg) text-(--color-action-secondary-text) border-(--color-action-secondary-border)',
          'enabled:hover:bg-(--color-action-secondary-bg-hover)',
        ],
        ghost: 'bg-transparent text-(--color-link) enabled:hover:bg-(--color-surface-hover) disabled:bg-transparent',
        danger: [
          'bg-(--color-action-danger-bg) text-(--color-action-danger-text)',
          'enabled:hover:bg-(--color-action-danger-bg-hover)',
        ],
      },
      size: {
        default: '',
        sm: 'min-h-(--control-height-sm) px-(--space-3) text-(length:--text-sm)',
        icon: 'w-(--control-height) px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

type ButtonProps = Omit<ButtonPrimitive.Props, 'className'> &
  VariantProps<typeof buttonVariants> & {
    className?: string
  }

/** Sin `type`, un botón dentro de un `<form>` lo enviaría: por defecto es `type="button"`. */
function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Indicador de «trabajando» para poner dentro de un botón (decorativo: el botón lleva `aria-busy`). */
function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      data-slot="spinner"
      className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:[animation-duration:2.4s]"
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- buttonVariants da las clases de botón a un enlace
export { Button, ButtonSpinner, buttonVariants }
