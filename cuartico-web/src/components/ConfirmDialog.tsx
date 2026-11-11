import { useEffect, useId, useRef, type ReactNode } from 'react'

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
 * Diálogo de confirmación con `<dialog>` nativo: el navegador atrapa el foco, cierra con Escape y, al cerrarse,
 * devuelve el foco al botón que lo abrió. El botón de confirmar es primario y NO rojo: lo usamos para acciones
 * reversibles (desactivar, descartar cambios); el rojo se reserva a lo irreversible (design system §3.1).
 */
export function ConfirmDialog({ open, title, children, cancelLabel, confirmLabel, onCancel, onConfirm, busy }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()

  // Efecto: sincroniza `open` (estado de React) con el <dialog> del navegador.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) {
      dialog.close() // el navegador devuelve el foco al botón que lo abrió…
      // …salvo que ese botón ya no exista (p. ej. la fila desactivada salió del listado): al inicio del contenido.
      if (!document.activeElement || document.activeElement === document.body) document.getElementById('main')?.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="c-modal"
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={(e) => {
        e.preventDefault() // Escape: lo decide React (onCancel), no el navegador por su cuenta
        if (!busy) onCancel()
      }}
    >
      <div className="c-modal__body">
        <h2 id={titleId}>{title}</h2>
        {children && (
          <div id={bodyId} className="c-modal__text">
            {children}
          </div>
        )}
      </div>
      <div className="c-modal__actions btn-bar">
        {cancelLabel && (
          <button type="button" className="c-btn c-btn--secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          className="c-btn c-btn--primary"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy && <span className="spinner" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
