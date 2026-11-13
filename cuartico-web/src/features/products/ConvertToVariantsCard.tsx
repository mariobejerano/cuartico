import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiError } from '../../api/errors'
import type { ProductResponse } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { messageForError } from '../../components/errorMessage'
import { FieldErrorText } from '../../components/fieldMessage'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/toast'
import { useConvertVariants } from './queries'
import { RACE_CODES, useErrorToast } from './useErrorToast'
import { useProductFormat } from './useProductFormat'
import { COLOR_MAX, normalizeColor, normalizeSize, SIZE_MAX } from './variants'

interface ConvertToVariantsCardProps {
  product: ProductResponse
  formDirty: boolean
  /** Convertido: el producto cambió de versión; el formulario se recarga y se abre «Añadir variantes». */
  onConverted: (fromApi: ProductResponse) => void
  onStale: () => void
  onSaveFirst: () => void
}

/**
 * Tarjeta «Tallas y colores» de un producto SIMPLE en edición (CA-12, CA-22): explica que no tiene variantes y ofrece
 * convertirlo. La conversión se guarda al momento (fuera del formulario) y sube la versión del producto, así que
 * con cambios sin guardar primero pide guardarlos.
 */
export function ConvertToVariantsCard({ product, formDirty, onConverted, onStale, onSaveFirst }: ConvertToVariantsCardProps) {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const toast = useToast()
  const showError = useErrorToast()
  const convert = useConvertVariants()
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  /** Clave de traducción de un error nuestro, o texto ya traducido de la API. */
  const [error, setError] = useState<{ key?: string; text?: string } | null>(null)

  const start = () => {
    if (formDirty) return onSaveFirst()
    setSize('')
    setColor('')
    setError(null)
    setOpen(true)
  }

  const confirm = () => {
    if (convert.isPending) return
    const s = normalizeSize(size)
    const c = normalizeColor(color)
    if (!s && !c) return setError({ key: 'variant.options_required' })
    convert.mutate(
      { id: product.id, enable: { size: s, color: c } },
      {
        onSuccess: (saved) => {
          setOpen(false)
          toast({ text: t('variants.enabled', { name: saved.name }) })
          onConverted(saved)
        },
        onError: (e) => {
          if (isApiError(e) && e.code && RACE_CODES.includes(e.code)) {
            setOpen(false)
            showError(e)
            return onStale()
          }
          const m = messageForError(e)
          setError(m.text ? { text: m.text } : { key: m.bodyKey ?? 'net.unexpected_generic' })
        },
      },
    )
  }

  const errorText = error ? (error.text ?? t(error.key ?? 'net.unexpected_generic')) : null
  const describedBy = error ? 'enable-error' : undefined

  return (
    <div className="card status-card">
      <div>
        <h2>{t('variants.section')}</h2>
        <p className="muted small">{t('variants.simple_text')}</p>
      </div>
      <button type="button" className="c-btn c-btn--secondary" onClick={start}>
        <Icon name="grid" />
        <span>{t('variants.to_variants')}</span>
      </button>

      <ConfirmDialog
        open={open}
        title={t('variants.to_variants')}
        cancelLabel={t('common.cancel')}
        confirmLabel={<span>{t('variants.convert')}</span>}
        busy={convert.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      >
        <p>{t('variants.enable_body', { onHand: fmt.quantity(product.stock.onHand, product.unit) })}</p>
        <div className="grid-2">
          <div className="c-field">
            <label className="c-label" htmlFor="enable-size">
              {t('variants.size')}
            </label>
            <input
              className="c-input"
              id="enable-size"
              maxLength={SIZE_MAX}
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              value={size}
              onChange={(e) => setSize(e.target.value)}
              onBlur={() => setSize(size.trim().toUpperCase())}
            />
          </div>
          <div className="c-field">
            <label className="c-label" htmlFor="enable-color">
              {t('variants.color')}
            </label>
            <input
              className="c-input"
              id="enable-color"
              maxLength={COLOR_MAX}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>
        <FieldErrorText id="enable-error" text={errorText} />
      </ConfirmDialog>
    </div>
  )
}
