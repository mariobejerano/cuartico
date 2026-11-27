import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * Botón de shadcn/ui (estilo base-nova, primitivo de Base UI), adaptado a Cuartico (TT-19; design system v0.2 §7.1).
 * Desde la fase 1 los tokens están en `@theme`: `bg-primary`, `h-control`, `rounded-md`… son utilidades de Tailwind
 * que leen las variables de Lienzo (tokens.css), y cambian solas con el tema claro/oscuro.
 *
 * Notas de Tailwind v4:
 * - `hover:` solo se aplica en dispositivos con ratón (`@media (hover: hover)`).
 * - `enabled:` evita que un botón deshabilitado cambie de color al pasar el ratón o pulsarlo.
 * - Foco: `outline-ring` (ámbar, §6). Nunca el `ring-ring/50` de shadcn: no llega a 3:1.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'h-control px-4 rounded-md border border-solid border-transparent',
    '[font-family:inherit] text-control font-medium leading-tight no-underline cursor-pointer',
    'transition-colors duration-(--duration-fast) ease-(--easing-standard)',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** Una acción principal por vista. */
        default: 'bg-primary text-primary-foreground shadow-xs enabled:hover:bg-primary-hover',
        /** Alternativas (Cancelar, Editar en tarjeta). Borde decorativo: el texto identifica el botón. */
        outline: 'bg-card text-foreground border-border shadow-xs enabled:hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground enabled:hover:bg-secondary-hover',
        /** Terciarias e iconos (⋯, sol/luna). */
        ghost: 'bg-transparent text-foreground enabled:hover:bg-accent',
        /** Solo para borrar/anular, dentro de una confirmación. */
        destructive: 'bg-destructive text-destructive-foreground shadow-xs enabled:hover:bg-destructive-hover',
        link: 'h-auto px-0 bg-transparent text-primary underline underline-offset-2',
      },
      size: {
        default: '',
        sm: 'h-control-sm px-3',
        icon: 'size-control px-0',
        'icon-sm': 'size-control-sm px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
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
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:[animation-duration:2.4s]"
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- buttonVariants da las clases de botón a un enlace
export { Button, ButtonSpinner, buttonVariants }
