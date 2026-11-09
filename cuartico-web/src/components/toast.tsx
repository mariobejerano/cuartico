/* eslint-disable react-refresh/only-export-components -- el proveedor y su hook van juntos a propósito */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

export interface ToastInput {
  /** Texto ya traducido (con el nombre del producto dentro, p. ej. «Producto «Arroz» creado.»). */
  text: string
  variant?: 'success' | 'danger'
  /** Botón opcional, p. ej. «Deshacer». */
  action?: { label: string; run: () => void }
}
interface ToastItem extends ToastInput {
  id: number
}

const AUTO_CLOSE_MS = 5_000
const MAX_TOASTS = 3

type ShowToast = (toast: ToastInput) => void
const ToastContext = createContext<ShowToast | null>(null)

/**
 * Avisos flotantes (design system §7, prototipo products.html). El proveedor vive en el layout, así que un
 * aviso lanzado desde el formulario sigue visible tras volver al listado.
 *
 * CONTEXTO: `createContext` + `useContext` es la forma de React de compartir algo con todos los componentes de
 * debajo sin pasarlo por props en cada nivel. Analogía: un bean singleton que cualquiera puede inyectar.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback<ShowToast>((toast) => {
    const id = nextId.current++
    setToasts((list) => [...list, { ...toast, id }].slice(-MAX_TOASTS))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Región siempre presente: los lectores de pantalla solo anuncian cambios en regiones que ya existían. */}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const { t } = useTranslation()
  const [paused, setPaused] = useState(false)
  const remaining = useRef(AUTO_CLOSE_MS)
  const danger = toast.variant === 'danger'
  const { id } = toast

  // Los de éxito se cierran solos a los 5 s; se pausan con el ratón o el foco encima. Los de error, nunca.
  useEffect(() => {
    if (danger || paused) return
    const start = Date.now()
    const timer = setTimeout(() => onClose(id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - start
    }
  }, [danger, paused, onClose, id])

  return (
    <div
      className={`c-toast c-toast--${danger ? 'danger' : 'success'}`}
      role={danger ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={danger ? 'alert' : 'check'} />
      <span className="msg">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="c-btn c-btn--ghost c-btn--sm"
          onClick={() => {
            onClose(id)
            toast.action?.run()
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="c-btn c-btn--ghost c-btn--icon" aria-label={t('common.close')} onClick={() => onClose(id)}>
        <Icon name="x" />
      </button>
    </div>
  )
}

/** Lanza un aviso: `const toast = useToast(); toast({ text: '…' })`. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
