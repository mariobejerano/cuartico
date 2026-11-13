import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { isApiError } from '../../api/errors'
import { productsApi } from '../../api/products'
import type { ProductResponse, VariantResponse } from '../../api/types'
import { Alert } from '../../components/Alert'
import { ErrorAlert } from '../../components/ErrorAlert'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { FieldErrorText, useFieldErrorText } from '../../components/fieldMessage'
import { inputToDecimal } from './format'
import {
  buildVariantEditSchema,
  isVariantField,
  variantToEditValues,
  type VariantEditValues,
  type VariantField,
} from './productSchema'
import { productKeys, useUpdateVariant } from './queries'
import { RACE_CODES } from './useErrorToast'
import { normalizeColor, normalizeSize, variantName, variantsOf } from './variants'

interface VariantEditRowProps {
  product: ProductResponse
  variant: VariantResponse
  unitShort: string
  onCancel: () => void
  /** Guardada: recibe el producto que devolvió la API. */
  onSaved: (fromApi: ProductResponse) => void
  /** Se releyó el producto (tras un conflicto de versión): para poner al día la lista. */
  onReloaded: (fresh: ProductResponse) => void
  /** Error que obliga a recargar todo el producto (carrera) o la variante ya no existe. */
  onStale: (e: unknown) => void
}

/**
 * Una variante en modo edición (CA-9, CA-22): mini-formulario con Talla, Color, SKU y Stock mínimo.
 * Es un `<form>` propio (la tarjeta de variantes está FUERA del formulario del producto): Intro guarda, Esc cancela.
 * Se guarda al momento con su propia `version` y no toca el formulario del producto (CA-13b).
 */
export function VariantEditRow({ product, variant, unitShort, onCancel, onSaved, onReloaded, onStale }: VariantEditRowProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const errorText = useFieldErrorText()
  const queryClient = useQueryClient()
  const update = useUpdateVariant()
  const [conflict, setConflict] = useState(false)
  const [rowError, setRowError] = useState<UiMessage | null>(null)

  // Las DEMÁS variantes: con ellas el esquema detecta en el navegador SKU y opciones repetidos.
  const others = useMemo(() => variantsOf(product).filter((v) => v.id !== variant.id), [product, variant.id])
  const resolver = useMemo(() => zodResolver(buildVariantEditSchema(others)), [others])
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    reset,
    formState: { errors },
  } = useForm<VariantEditValues>({ resolver, defaultValues: variantToEditValues(variant, lang) })

  useEffect(() => setFocus('size'), [setFocus])

  const onError = (e: unknown) => {
    if (isApiError(e) && e.kind === 'http') {
      const server = (field: VariantField, message: string | undefined) =>
        setError(field, { type: 'server', message: message ?? t('net.unexpected_generic') }, { shouldFocus: true })
      if (e.code === 'resource.version_conflict') return setConflict(true)
      if (e.code === 'variant.options_conflict' || e.code === 'variant.options_required') return server('size', e.detail)
      if (e.code === 'product.sku_conflict') return server('sku', e.detail)
      if (e.code === 'variant.not_found' || (e.code && RACE_CODES.includes(e.code))) return onStale(e)
      if (e.code === 'validation.failed') {
        const fields = Object.entries(e.errors ?? {}).filter(([f]) => isVariantField(f))
        fields.forEach(([f, m]) => server(f as VariantField, m))
        if (fields.length > 0) return
      }
    }
    setRowError(messageForError(e))
  }

  const submit = handleSubmit((values) => {
    if (update.isPending) return
    setConflict(false)
    setRowError(null)
    update.mutate(
      {
        id: product.id,
        variantId: variant.id,
        body: {
          sku: values.sku.trim().toUpperCase() || null,
          size: normalizeSize(values.size),
          color: normalizeColor(values.color),
          minStock: inputToDecimal(values.minStock) ?? 0,
          version: variant.version,
        },
      },
      { onSuccess: onSaved, onError },
    )
  })

  /** Conflicto de versión: no hay `GET` de una variante; se relee el producto y se toma esta (CA-22). */
  const reloadRow = async () => {
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: productKeys.detail(product.id),
        queryFn: ({ signal }) => productsApi.get(product.id, signal),
        staleTime: 0,
      })
      onReloaded(fresh)
      const v = variantsOf(fresh).find((x) => x.id === variant.id)
      if (!v) return onCancel()
      reset(variantToEditValues(v, lang))
      setConflict(false)
      setRowError(null)
    } catch (e) {
      setRowError(messageForError(e))
    }
  }

  const id = `ve-${variant.id}`
  const optionsError = errorText(errors.size)
  const a11y = (field: VariantField) => {
    // Talla y color comparten el error de opciones (se pinta una vez, bajo la pareja).
    const err = field === 'color' ? (errors.color ?? errors.size) : errors[field]
    const errId = field === 'size' || field === 'color' ? (errors.color ? `${id}-color-error` : `${id}-options-error`) : `${id}-${field}-error`
    return {
      id: `${id}-${field}`,
      'aria-invalid': err ? true : undefined,
      'aria-describedby': err ? errId : undefined,
    }
  }
  const busy = update.isPending

  return (
    <form
      className="v-row v-row--edit"
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      aria-labelledby={`${id}-t`}
    >
      <div className="v-title" id={`${id}-t`}>
        <span className="vt">{variantName(variant)}</span>
        {!variant.active && <span className="c-badge c-badge--neutral">{t('variants.badge_inactive')}</span>}
      </div>
      <div className="v-fields">
        <div className="c-field">
          <label className="c-label" htmlFor={`${id}-size`}>
            {t('variants.size')}
          </label>
          <input
            className="c-input"
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            {...a11y('size')}
            {...register('size', {
              // Al salir, en mayúsculas: se ve lo que guardará la API (CA-6).
              onBlur: (e: FocusEvent<HTMLInputElement>) => setValue('size', e.target.value.trim().toUpperCase()),
            })}
          />
        </div>
        <div className="c-field">
          <label className="c-label" htmlFor={`${id}-color`}>
            {t('variants.color')}
          </label>
          <input className="c-input" maxLength={30} autoComplete="off" {...a11y('color')} {...register('color')} />
          <FieldErrorText id={`${id}-color-error`} text={errorText(errors.color)} />
        </div>
        <div className="c-field">
          <label className="c-label" htmlFor={`${id}-sku`}>
            {t('products.sku')}
          </label>
          <input
            className="c-input"
            maxLength={50}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            {...a11y('sku')}
            {...register('sku', {
              onBlur: (e: FocusEvent<HTMLInputElement>) => setValue('sku', e.target.value.trim().toUpperCase()),
            })}
          />
          <FieldErrorText id={`${id}-sku-error`} text={errorText(errors.sku)} />
        </div>
        <div className="c-field">
          <label className="c-label" htmlFor={`${id}-minStock`}>
            {t('products.min_stock')}
          </label>
          <div className="c-input-group">
            <input className="c-input num" inputMode="decimal" autoComplete="off" {...a11y('minStock')} {...register('minStock')} />
            <span className="suffix" aria-hidden="true">
              {unitShort}
            </span>
          </div>
          <FieldErrorText id={`${id}-minStock-error`} text={errorText(errors.minStock)} />
        </div>
      </div>
      <FieldErrorText id={`${id}-options-error`} text={optionsError} />
      {conflict && (
        <Alert
          variant="danger"
          action={
            <button type="button" className="c-btn c-btn--secondary" onClick={() => void reloadRow()}>
              {t('variants.reload_row')}
            </button>
          }
        >
          {t('variants.version_conflict')}
        </Alert>
      )}
      {rowError && <ErrorAlert message={rowError} onRetry={() => void submit()} />}
      <div className="btn-bar">
        <button type="button" className="c-btn c-btn--secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="c-btn c-btn--primary" disabled={busy} aria-busy={busy || undefined}>
          {busy && <span className="spinner" aria-hidden="true" />}
          <span>{t(busy ? 'common.saving' : 'variants.save_row')}</span>
        </button>
      </div>
    </form>
  )
}
