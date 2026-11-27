import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Etiqueta de campo (shadcn/ui, design system v0.2 §7.2): visible, ENCIMA del campo, 14 px y 500.
 * Nunca se usa el placeholder como etiqueta. «(obligatorio)» / «(opcional)» van en un <span> con
 * `font-normal text-muted-foreground` dentro de la etiqueta.
 */
function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('inline-flex items-center gap-1 text-sm leading-tight font-medium text-foreground', className)}
      {...props}
    />
  )
}

export { Label }
