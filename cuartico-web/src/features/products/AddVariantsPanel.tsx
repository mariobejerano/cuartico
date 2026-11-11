import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { isApiError } from '../../api/errors'
import type { ProductResponse } from '../../api/types'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useFocusAfterRender } from '../../components/useFocusAfterRender'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { listError, useFieldErrorText } from '../../components/fieldMessage'
import { DraftVariantList } from './DraftVariantList'
import { buildAddVariantsSchema, type AddVariantsFormValues } from './productSchema'
import { useAddVariants } from './queries'
import { RACE_CODES } from './useErrorToast'
import { VariantGenerator } from './VariantGenerator'
import { draftToRequest, generatorSizeId, firstAdded, mergeDrafts, rowErrorsFrom, variantsOf, type DraftVariant } from './variants'

const GEN_ID = 'gen-add'

interface AddVariantsPanelProps {
  product: ProductResponse
  unitShort: string
  /** Guardadas: recibe el producto de la API y cuántas se añadieron. */
  onAdded: (fromApi: ProductResponse, count: number) => void
  onCancel: () => void
  /** Carrera (p. ej. otra persona lo convirtió en simple): recargar todo. */
  onStale: (e: unknown) => void
}

/**
 * Panel «Añadir variantes» de un producto que ya tiene (CA-8, CA-22). Reutiliza el generador y la lista por guardar
 * del alta; es un FORMULARIO APARTE del del producto (con su propio `useForm`), porque se guarda al momento con su
 * propio botón y todo o nada.
 */
export function AddVariantsPanel({ product, unitShort, onAdded, onCancel, onStale }: AddVariantsPanelProps) {
  const { t } = useTranslation()
  const errorText = useFieldErrorText()
  const add = useAddVariants()
  const [submitError, setSubmitError] = useState<UiMessage | null>(null)
  const focusAfter = useFocusAfterRender()
  const existing = useMemo(() => variantsOf(product), [product])

  const resolver = useMemo(() => zodResolver(buildAddVariantsSchema(existing)), [existing])
  const { control, register, handleSubmit, setValue, setError, getValues, formState } = useForm<AddVariantsFormValues>({
    resolver,
    defaultValues: { variants: [] },
    mode: 'onTouched',
  })
  // CAMPOS DINÁMICOS: `useFieldArray` gestiona una lista de filas dentro del formulario (añadir, quitar, reemplazar).
  const { fields, replace, remove } = useFieldArray({ control, name: 'variants' })
  const rows = useWatch({ control, name: 'variants' })

  // Al abrir el panel, foco en «Tallas».
  useEffect(() => document.getElementById(generatorSizeId(GEN_ID))?.focus(), [])

  const onApply = (added: DraftVariant[]) => {
    const merged = mergeDrafts(getValues('variants'), added)
    replace(merged)
    const first = firstAdded(merged, added)
    // Cuando ya estén pintadas, el foco va al SKU de la primera fila nueva.
    focusAfter(() => document.getElementById(`staged-${first?.key}-sku`))
  }

  const onError = (e: unknown, values: AddVariantsFormValues) => {
    if (isApiError(e) && e.kind === 'http') {
      if (e.code && RACE_CODES.includes(e.code)) return onStale(e)
      const mapped = rowErrorsFrom(e, values.variants)
      mapped.forEach((r, i) =>
        setError(
          `variants.${r.index}.${r.field === 'options' ? 'size' : r.field}`,
          { type: 'server', message: r.message || t('net.unexpected_generic') },
          { shouldFocus: i === 0 && r.field !== 'options' },
        ),
      )
      if (mapped.length > 0) return
    }
    setSubmitError(messageForError(e))
  }

  const save = handleSubmit((values) => {
    if (add.isPending) return
    setSubmitError(null)
    add.mutate(
      { id: product.id, variants: values.variants.map(draftToRequest) },
      { onSuccess: (saved) => onAdded(saved, values.variants.length), onError: (e) => onError(e, values) },
    )
  })

  const focusSizes = useCallback(() => document.getElementById(generatorSizeId(GEN_ID))?.focus(), [])
  const rowErrors = formState.errors.variants
  const rootError = errorText(listError(rowErrors))
  const count = fields.length
  const busy = add.isPending

  return (
    <form className="add-panel" id="add-variants-panel" noValidate onSubmit={save}>
      <VariantGenerator
        idPrefix={GEN_ID}
        existing={[...existing, ...(rows ?? [])]}
        takenSkus={[...existing.map((v) => v.sku ?? ''), ...(rows ?? []).map((r) => r.sku)]}
        unitShort={unitShort}
        onApply={onApply}
      />
      {count > 0 && (
        <div>
          <div className="v-count">
            <span role="status">{t('variants.staged', { count })}</span>
          </div>
          <DraftVariantList
            idPrefix="staged"
            rows={fields.map((f, i) => ({ ...(rows?.[i] ?? f), fieldId: f.id }))}
            label={t('variants.staged', { count })}
            unitShort={unitShort}
            registerField={(i, field) =>
              register(`variants.${i}.${field}`, {
                onBlur:
                  field === 'sku'
                    ? (e: FocusEvent<HTMLInputElement>) =>
                        setValue(`variants.${i}.sku`, e.target.value.trim().toUpperCase(), { shouldValidate: true })
                    : undefined,
              })
            }
            errorOf={(i, field) => errorText(rowErrors?.[i]?.[field === 'options' ? 'size' : field])}
            onRemove={remove}
            focusWhenEmpty={focusSizes}
          />
        </div>
      )}
      {rootError && <p className="c-error">{rootError}</p>}
      <div className="alerts">{submitError && <ErrorAlert message={submitError} onRetry={() => void save()} />}</div>
      <div className="btn-bar">
        <button type="button" className="c-btn c-btn--secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="c-btn c-btn--primary" disabled={count === 0 || busy} aria-busy={busy || undefined}>
          {busy && <span className="spinner" aria-hidden="true" />}
          <span>{t(busy ? 'common.saving' : 'variants.save_new', { count })}</span>
        </button>
      </div>
    </form>
  )
}
