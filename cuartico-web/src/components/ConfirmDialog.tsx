import { useRef, type ReactNode } from 'react'
import { Button, ButtonSpinner } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  children?: ReactNode
  /** Sin `cancelLabel` es un diálogo informativo: un solo botón (p. ej. «Entendido»). Escape sigue llamando a `onCancel`. */
  cancelLabel?: string
  confirmLabel: ReactNode
  onCancel: () => void
  onConfirm: () => void
  /** Mientras se confirma (petición en curso): botones deshabilitados y spinner. */
  busy?: boolean
}

/**
 * Diálogo de confirmación con el Dialog de shadcn/ui sobre Base UI (TT-19, fase 0; antes era un `<dialog>` nativo).
 * Base UI atrapa el foco, cierra con Escape y, al cerrarse, devuelve el foco al botón que lo abrió. El botón de
 * confirmar es primario y NO rojo: lo usamos para acciones reversibles (desactivar, descartar cambios); el rojo se
 * reserva a lo irreversible (design system §3.1).
 *
 * Es un diálogo "controlado": React decide si está abierto (`open`). Base UI solo nos avisa de que el usuario quiere
 * cerrarlo (`onOpenChange(false)` por Escape) y somos nosotros quienes llamamos a `onCancel`.
 */
export function ConfirmDialog({ open, title, children, cancelLabel, confirmLabel, onCancel, onConfirm, busy }: ConfirmDialogProps) {
  // Botón que tenía el foco al abrir, para devolvérselo al cerrar.
  const returnTo = useRef<HTMLElement | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel() // Escape: lo decide React (onCancel), nunca mientras hay una petición en curso
      }}
      disablePointerDismissal // como el <dialog> nativo: pulsar fuera no cierra
    >
      <DialogContent
        initialFocus={() => {
          // Se llama justo al abrir, antes de mover el foco dentro del diálogo.
          returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          return true
        }}
        finalFocus={() => {
          // Si el botón ya no existe (p. ej. la fila desactivada salió del listado): al inicio del contenido.
          const target = returnTo.current
          return target?.isConnected ? target : (document.getElementById('main') ?? true)
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {children && <DialogDescription>{children}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          {cancelLabel && (
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
          )}
          <Button onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            {busy && <ButtonSpinner />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
