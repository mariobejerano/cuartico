import { useRef } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FieldErrorText } from '../../components/fieldMessage'
import { Icon } from '../../components/Icon'
import { useFocusAfterRender } from '../../components/useFocusAfterRender'
import { variantName, type VariantOptions } from './variants'

type RowField = 'sku' | 'minStock' | 'options'

interface DraftVariantListProps {
  /** Prefijo de los `id` («draft», «staged»). */
  idPrefix: string
  /** Las filas: `key` (estable, para los `id`), `fieldId` (la clave de React que da `useFieldArray`) y sus opciones. */
  rows: readonly (VariantOptions & { key: string; fieldId: string })[]
  /** Nombre accesible de la lista («8 variantes», «3 variantes por guardar»). */
  label: string
  unitShort: string
  /** Conecta cada input con React Hook Form (`register('variants.2.sku')`). */
  registerField: (index: number, field: 'sku' | 'minStock') => UseFormRegisterReturn
  /** Texto del error de un campo de la fila, ya traducido (o `null`). `options` = error de talla/color de la fila. */
  errorOf: (index: number, field: RowField) => string | null
  onRemove: (index: number) => void
  /** Adónde va el foco si se quita la última fila (el campo «Tallas» del generador). */
  focusWhenEmpty: () => void
}

/**
 * Lista de variantes «por guardar» (alta del producto y «Añadir variantes», CA-21/CA-22).
 * COMPONENTE DE PRESENTACIÓN: no sabe de qué formulario son las filas; recibe funciones para conectar los campos
 * (`registerField`) y leer sus errores (`errorOf`). Así lo reutilizan dos formularios distintos.
 *
 * Una sola marcación para móvil y escritorio (`<ul>` de filas; el CSS las pinta como tarjetas o como tabla):
 * sin scroll lateral a 360 px (CA-24) y sin inputs duplicados. Cada campo se nombra con su fila («M · Blanco SKU»).
 */
export function DraftVariantList({ idPrefix, rows, label, unitShort, registerField, errorOf, onRemove, focusWhenEmpty }: DraftVariantListProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLUListElement>(null)
  const focusAfter = useFocusAfterRender()

  /** Tras quitar una fila, su botón ya no existe: el foco pasa al «quitar» de la siguiente (o al generador). */
  const removeAt = (index: number) => {
    onRemove(index)
    focusAfter(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove]') ?? []
      const next = buttons[Math.min(index, buttons.length - 1)]
      if (next) return next
      focusWhenEmpty()
      return null
    })
  }

  if (rows.length === 0) return null
  return (
    <>
      <div className="v-head v-head--draft" aria-hidden="true">
        <span>{t('variants.col_variant')}</span>
        <span>{t('products.sku')}</span>
        <span>{t('products.min_stock')}</span>
        <span />
      </div>
      <ul className="v-list" ref={listRef} aria-label={label}>
        {rows.map((row, i) => {
          const id = `${idPrefix}-${row.key}`
          const name = variantName(row)
          const skuError = errorOf(i, 'sku')
          const minError = errorOf(i, 'minStock')
          const optionsError = errorOf(i, 'options')
          return (
            <li className="v-row v-row--draft" key={row.fieldId}>
              <div className="v-title">
                {/* Solo el nombre da nombre a los campos («M · Blanco SKU»); el error va aparte */}
                <span className="vt" id={`${id}-t`}>
                  {name}
                </span>
                <FieldErrorText id={`${id}-options-error`} text={optionsError} />
              </div>
              <div className="c-field f-sku">
                <label className="c-label v-lbl" id={`${id}-sku-l`} htmlFor={`${id}-sku`}>
                  {t('products.sku')}
                </label>
                <input
                  className="c-input"
                  id={`${id}-sku`}
                  maxLength={50}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-labelledby={`${id}-t ${id}-sku-l`}
                  aria-invalid={skuError ? true : undefined}
                  aria-describedby={skuError ? `${id}-sku-error` : undefined}
                  {...registerField(i, 'sku')}
                />
                <FieldErrorText id={`${id}-sku-error`} text={skuError} />
              </div>
              <div className="c-field f-min">
                <label className="c-label v-lbl" id={`${id}-min-l`} htmlFor={`${id}-min`}>
                  {t('products.min_stock')}
                </label>
                <div className="c-input-group">
                  <input
                    className="c-input num"
                    id={`${id}-min`}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-labelledby={`${id}-t ${id}-min-l`}
                    aria-invalid={minError ? true : undefined}
                    aria-describedby={minError ? `${id}-min-error` : undefined}
                    {...registerField(i, 'minStock')}
                  />
                  <span className="suffix" aria-hidden="true">
                    {unitShort}
                  </span>
                </div>
                <FieldErrorText id={`${id}-min-error`} text={minError} />
              </div>
              <button
                type="button"
                className="c-btn c-btn--ghost c-btn--icon rm"
                data-remove=""
                aria-label={t('variants.remove', { name })}
                onClick={() => removeAt(i)}
              >
                <Icon name="x" />
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
