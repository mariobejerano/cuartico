import { CircleAlert } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Bloque de campo (inspirado en el Field de shadcn/ui; design system v0.2 §7.2):
 *   <Field>
 *     <Label htmlFor="sku">SKU <span className="font-normal text-muted-foreground">(opcional)</span></Label>
 *     <Input id="sku" aria-invalid={!!error} aria-describedby={error ? 'sku-error' : 'sku-help'} />
 *     <FieldDescription id="sku-help">…</FieldDescription>
 *     <FieldError id="sku-error">…</FieldError>
 *   </Field>
 * Son solo maquetación: el `id`, `aria-invalid` y `aria-describedby` los pone la pantalla (con React Hook Form),
 * igual que hoy con las clases `c-field`.
 */
function Field({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('grid content-start gap-1.5', className)} {...props} />
}

/** Ayuda bajo el campo: 14 px, `muted-foreground`. */
function FieldDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="field-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

/** Mensaje de error: 14 px en `destructive` con icono (el color nunca va solo). */
function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null
  return (
    <p data-slot="field-error" className={cn('flex items-start gap-1 text-sm text-destructive', className)} {...props}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export { Field, FieldDescription, FieldError }
