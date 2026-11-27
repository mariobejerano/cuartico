import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Tarjeta (shadcn/ui, design system v0.2 §7.4): `bg-card`, borde decorativo, `rounded-xl`, `shadow-sm`.
 * Padding 16 px en móvil y 20 × 24 px desde 768 px (la tarjeta pone el vertical; cada parte, el horizontal).
 * Agrupa sin líneas y deja respirar el fondo arena. Los formularios se dividen en tarjetas por sección.
 */
function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-solid border-border bg-card py-4 text-card-foreground shadow-sm md:py-5',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('grid gap-1 px-4 md:px-6', className)} {...props} />
}

/** Título de tarjeta: `<h2>` de 17 px y 700 (§4). */
function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('text-[1.0625rem] leading-tight font-bold', className)} {...props} />
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-4 md:px-6', className)} {...props} />
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex flex-wrap items-center gap-3 px-4 md:px-6', className)} {...props} />
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
