/* eslint-disable react-refresh/only-export-components -- utilidades de formulario: funciones y un componente pequeño juntos */
import type { FieldError as RhfFieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

/**
 * Mensajes de error de los formularios (productos, categorías…).
 *
 * Zod y React Hook Form solo guardan un TEXTO por error. Para seguir guardando CLAVES de traducción (y no textos,
 * que cambian con el idioma) codificamos la clave y sus variables así: `clave|{"max":120}`. Se traduce al pintar.
 */
export const msg = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}|${JSON.stringify(vars)}` : key)

export function parseMsg(message: string): { key: string; vars?: Record<string, unknown> } {
  const i = message.indexOf('|')
  if (i < 0) return { key: message }
  return { key: message.slice(0, i), vars: JSON.parse(message.slice(i + 1)) as Record<string, unknown> }
}

/**
 * Texto de un error de campo. Los nuestros son claves (con variables); los que pone el servidor (`type: 'server'`)
 * ya vienen traducidos en el `detail` de la API y se muestran tal cual.
 */
export function useFieldErrorText() {
  const { t } = useTranslation()
  return (error: RhfFieldError | undefined): string | null => {
    if (!error?.message) return null
    if (error.type === 'server') return error.message
    const { key, vars } = parseMsg(error.message)
    return t(key, vars ?? {})
  }
}

/**
 * Error de una LISTA de campos (`useFieldArray`), p. ej. «Añade al menos una variante». React Hook Form lo guarda en
 * `errors.variants.root` (si viene del esquema) o en `errors.variants` (si lo pone `setError`): devolvemos el que haya.
 */
export function listError(e: { root?: RhfFieldError; message?: string; type?: string } | undefined): RhfFieldError | undefined {
  if (e?.root) return e.root
  return e?.message ? { type: e.type ?? 'validate', message: e.message } : undefined
}

/** El párrafo rojo bajo un campo. `id` debe coincidir con el `aria-describedby` del campo. */
export function FieldErrorText({ id, text }: { id: string; text: string | null }) {
  if (!text) return null
  return (
    <p className="c-error" id={id}>
      <Icon name="alert" />
      <span>{text}</span>
    </p>
  )
}
