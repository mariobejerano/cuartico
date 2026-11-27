import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Campo de texto (shadcn/ui, design system v0.2 §7.2 y §6), adaptado a Cuartico (TT-19, fase 1).
 *
 * Diferencias con el de shadcn:
 * - `<input>` nativo en vez del Input de Base UI: React Hook Form lo controla con `register()` sin más piezas, y la
 *   validación ya la hace Zod (el Field de Base UI duplicaría esa lógica).
 * - Borde `border-input` (3.54:1, WCAG 1.4.11); el `border-input` de shadcn viene a ~1.3:1 y no se ve dónde escribir.
 * - Foco: borde `ring` + 1 px sólido + halo `ring` al 20 % de 3 px (sombras de `box-shadow`, no `outline`).
 * - Error: `aria-invalid="true"` pone el borde y el anillo en `destructive`. El mensaje lo pinta `FieldError`.
 */
const focusRing =
  'focus-visible:border-ring focus-visible:shadow-[0_0_0_1px_var(--color-ring),0_0_0_4px_color-mix(in_srgb,var(--color-ring)_20%,transparent)]'
const invalidRing =
  'aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_1px_var(--color-destructive)] aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--color-destructive),0_0_0_4px_color-mix(in_srgb,var(--color-destructive)_20%,transparent)]'

function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-control w-full min-w-0 rounded-md border border-solid border-input bg-card px-3 shadow-xs',
        '[font-family:inherit] text-control text-foreground placeholder:text-muted-foreground',
        'transition-[border-color,box-shadow] duration-(--duration-fast) outline-none',
        focusRing,
        invalidRing,
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:shadow-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
