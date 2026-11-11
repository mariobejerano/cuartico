import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { messageForError } from '../../components/errorMessage'
import { useToast } from '../../components/toast'

/**
 * Muestra un error como aviso rojo (no se cierra solo). Para acciones que se guardan al momento y no tienen un
 * formulario donde pintar el error (activar/desactivar una variante, carreras al convertir…).
 */
export function useErrorToast() {
  const { t } = useTranslation()
  const toast = useToast()
  return useCallback(
    (e: unknown) => {
      const m = messageForError(e)
      toast({ variant: 'danger', text: m.text ?? t(m.titleKey ?? m.bodyKey ?? 'net.unexpected_generic') })
    },
    [t, toast],
  )
}

/**
 * Errores 409 que solo ocurren por una CARRERA (otra persona convirtió el producto mientras tanto): la pantalla
 * está desfasada, así que se avisa y se recarga el producto (ux-notes products-v2 §5).
 */
export const RACE_CODES: readonly string[] = ['product.no_variants', 'product.has_variants', 'product.has_multiple_variants']
