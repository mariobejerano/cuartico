import { useCallback, useEffect, useRef } from 'react'

type Finder = () => HTMLElement | null | undefined

/**
 * «Cuando React termine de pintar, lleva el foco a…». Para los casos en que el elemento todavía no existe al pulsar
 * (la fila nueva del generador) o acaba de desaparecer (el «×» de la fila quitada, el formulario de la fila editada).
 *
 * Se guarda la búsqueda en un REF (no en estado: no hace falta repintar por ello) y un efecto SIN dependencias, que se
 * ejecuta tras cada pintada, la aplica una vez. Quien lo usa siempre cambia algún estado en el mismo evento, así que
 * la pintada llega. Uso: `const focusAfter = useFocusAfterRender(); focusAfter(() => document.getElementById('x'))`.
 */
export function useFocusAfterRender() {
  const pending = useRef<Finder | null>(null)
  useEffect(() => {
    const find = pending.current
    if (!find) return
    pending.current = null
    find()?.focus()
  })
  return useCallback((find: Finder) => {
    pending.current = find
  }, [])
}
