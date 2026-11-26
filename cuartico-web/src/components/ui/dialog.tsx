import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/*
 * Diálogo de shadcn/ui (estilo base-nova, primitivo de Base UI), adaptado a Cuartico (TT-19, fase 0).
 * Base UI pone role="dialog", aria-modal, aria-labelledby (Title) y aria-describedby (Description), atrapa el foco,
 * cierra con Escape y devuelve el foco al cerrar. Bloquea el scroll de la página con CSSOM (sin <style>: CSP intacta).
 *
 * Cambios respecto al original de shadcn:
 * - Sin botón «X» con texto fijo «Close»: cada diálogo pone sus propios botones con t() (i18n).
 * - Aspecto de `.c-modal`: hoja inferior en móvil (< 768 px), centrado en escritorio, con los tokens de Lienzo.
 * - Solo animación de entrada (`data-starting-style`): al cerrar desaparece al momento, como el <dialog> nativo,
 *   y no se ve el texto vaciarse mientras se anima la salida.
 */

const Dialog = DialogPrimitive.Root

type WithClassName<P> = Omit<P, 'className'> & { className?: string }

function DialogOverlay({ className, ...props }: WithClassName<DialogPrimitive.Backdrop.Props>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-(--z-modal) bg-(--overlay-bg)',
        'transition-opacity duration-(--duration-base) data-starting-style:opacity-0 motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }: WithClassName<DialogPrimitive.Popup.Props>) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed z-(--z-modal) overflow-auto bg-(--color-surface) text-(--color-text) shadow-(--shadow-lg) outline-none',
          'max-h-[calc(100dvh-2rem)]',
          // Móvil: hoja inferior a todo el ancho
          'inset-x-0 bottom-0 rounded-t-(--radius-lg) pb-[env(safe-area-inset-bottom)]',
          // Desde 768 px: centrado, como máximo 32rem
          'md:inset-x-auto md:bottom-auto md:start-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
          'md:w-[min(32rem,calc(100%-2*var(--space-4)))] md:rounded-(--radius-lg) md:pb-0',
          'transition-opacity duration-(--duration-base) data-starting-style:opacity-0 motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('grid gap-(--space-3) p-(--space-6)', className)} {...props} />
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-(--space-3) px-(--space-6) pb-(--space-6) *:w-full',
        'md:flex-row md:justify-end md:*:w-auto',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: WithClassName<DialogPrimitive.Title.Props>) {
  // Sin clases de tamaño: hereda el estilo de <h2> de global.css, como el resto de títulos de diálogo.
  return <DialogPrimitive.Title data-slot="dialog-title" className={className} {...props} />
}

function DialogDescription({ className, ...props }: WithClassName<DialogPrimitive.Description.Props>) {
  // <div> y no el <p> por defecto de Base UI: la descripción suele llevar varios párrafos (un <p> no puede contener otro).
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      render={<div />}
      className={cn('grid gap-(--space-3)', className)}
      {...props}
    />
  )
}

const DialogClose = DialogPrimitive.Close

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle }
