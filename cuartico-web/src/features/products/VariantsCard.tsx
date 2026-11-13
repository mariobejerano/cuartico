import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiError } from '../../api/errors'
import type { ProductResponse, VariantResponse } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/toast'
import { useFocusAfterRender } from '../../components/useFocusAfterRender'
import { AddVariantsPanel } from './AddVariantsPanel'
import { SHOW_STOCK_BADGES } from './features'
import { MoneyValue } from './MoneyValue'
import { useConvertVariants, useSetVariantActive } from './queries'
import { stockBadge } from './stockBadge'
import { RACE_CODES, useErrorToast } from './useErrorToast'
import { useProductFormat } from './useProductFormat'
import { VariantEditRow } from './VariantEditRow'
import { variantName, variantsOf } from './variants'

interface VariantsCardProps {
  /** El producto tal como lo conoce el formulario (con su versión). */
  product: ProductResponse
  isAdmin: boolean
  /** ¿Hay cambios sin guardar en el formulario del producto? Convertir lo recargaría (CA-22). */
  formDirty: boolean
  /** Abrir «Añadir variantes» al montarse (justo después de convertir un simple, ux-notes §4). */
  openAddOnMount: boolean
  /**
   * Respuesta de una operación de VARIANTE: quien tiene el estado pone al día la lista SIN tocar la versión del
   * producto (`mergeVariantData`, CA-13b).
   */
  onVariantResult: (fromApi: ProductResponse) => void
  /** Conversión a simple hecha: el producto cambió de versión y el formulario se recarga. */
  onConverted: (fromApi: ProductResponse) => void
  /** Algo cambió por debajo (carrera): recargar todo el producto. */
  onStale: () => void
  /** Avisar de que hay que guardar antes (formulario con cambios). */
  onSaveFirst: () => void
}

/**
 * Tarjeta «Tallas y colores (N)» de un producto con variantes (CA-22, ux-notes products-v2 §4). Va FUERA del
 * formulario del producto: todo lo que se hace aquí se guarda al momento, con su propio botón.
 * Contiene: total agregado (CA-15), lista de variantes (lectura o edición en línea, una a la vez),
 * activar/desactivar con «Deshacer» (solo ADMIN, D-3), «Añadir variantes» y «Convertir en producto simple».
 */
export function VariantsCard(props: VariantsCardProps) {
  const { product, isAdmin, formDirty, openAddOnMount, onVariantResult, onConverted, onStale, onSaveFirst } = props
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const toast = useToast()
  const showError = useErrorToast()
  const setActive = useSetVariantActive()
  const convert = useConvertVariants()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(openAddOnMount)
  const [confirmSimple, setConfirmSimple] = useState(false)
  const focusAfter = useFocusAfterRender()
  const addButton = useRef<HTMLButtonElement>(null)

  const variants = variantsOf(product)
  const inactive = variants.filter((v) => !v.active).length
  const unitShort = t(`unit_short.${product.unit}`)
  const applyVariantResult = (fromApi: ProductResponse) => onVariantResult(fromApi)

  /** Errores de las acciones directas (activar/desactivar, convertir): carrera → recargar; resto → aviso rojo. */
  const onActionError = (e: unknown) => {
    showError(e)
    if (isApiError(e) && (e.code === 'variant.not_found' || (e.code && RACE_CODES.includes(e.code)))) onStale()
  }

  // ----- Activar / desactivar (solo ADMIN). Sin diálogo: es reversible y de alcance pequeño (D-3) -----
  const toggle = (v: VariantResponse) => {
    if (setActive.isPending) return
    setActive.mutate(
      { id: product.id, variantId: v.id, active: !v.active },
      {
        onSuccess: (saved) => {
          applyVariantResult(saved)
          const name = variantName(v)
          if (v.active) {
            toast({
              text: t('variants.deactivated', { name }),
              // «Deshacer» = volver a activarla (sin otro aviso).
              action: {
                label: t('common.undo'),
                run: () =>
                  setActive.mutate(
                    { id: product.id, variantId: v.id, active: true },
                    { onSuccess: applyVariantResult, onError: onActionError },
                  ),
              },
            })
          } else toast({ text: t('variants.activated', { name }) })
        },
        onError: onActionError,
      },
    )
  }

  // ----- Convertir en producto simple (CA-13): solo con una variante; pide guardar antes si hay cambios -----
  const askToSimple = () => (formDirty ? onSaveFirst() : setConfirmSimple(true))
  const toSimple = () =>
    convert.mutate(
      { id: product.id, enable: null },
      {
        onSuccess: (saved) => {
          setConfirmSimple(false)
          toast({ text: t('variants.disabled_done', { name: saved.name }) })
          onConverted(saved)
        },
        onError: (e) => {
          setConfirmSimple(false)
          onActionError(e)
        },
      },
    )

  const closeEdit = (id: number) => {
    setEditingId(null)
    // Al cerrar la fila en edición, el foco vuelve a su botón «Editar».
    focusAfter(() => document.getElementById(`v-${id}-edit`))
  }
  const closeAdd = () => {
    setAddOpen(false)
    addButton.current?.focus()
  }

  const single = variants.length === 1 ? variants[0] : null

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('variants.title_count', { count: product.variantCount })}</h2>
        <button
          ref={addButton}
          type="button"
          className="c-btn c-btn--secondary"
          aria-expanded={addOpen}
          aria-controls="add-variants-panel"
          onClick={() => (addOpen ? closeAdd() : setAddOpen(true))}
        >
          <Icon name="plus" />
          <span>{t('variants.add')}</span>
        </button>
      </div>
      <p className="c-help">{t('variants.immediate_note')}</p>

      {addOpen && (
        <AddVariantsPanel
          product={product}
          unitShort={unitShort}
          onAdded={(saved, count) => {
            applyVariantResult(saved)
            toast({ text: t('variants.added', { count }) })
            closeAdd()
          }}
          onCancel={closeAdd}
          onStale={(e) => {
            closeAdd()
            onActionError(e)
          }}
        />
      )}

      {/* Total de todas las variantes, también las inactivas (CA-15): solo lectura */}
      <h3 className="sr-only" id="variants-total">
        {t('variants.total_title')}
      </h3>
      <dl className="ro-grid variants-total" aria-labelledby="variants-total">
        <div>
          <dt>{t('products.on_hand')}</dt>
          <dd>{fmt.quantity(product.stock.onHand, product.unit)}</dd>
        </div>
        <div>
          <dt>{t('products.reserved')}</dt>
          <dd>{fmt.quantity(product.stock.reserved, product.unit)}</dd>
        </div>
        <div>
          <dt>{t('products.available')}</dt>
          <dd>{fmt.quantity(product.stock.available, product.unit)}</dd>
        </div>
        <div>
          <dt>{t('products.avg_cost')}</dt>
          <dd>
            <MoneyValue amount={product.stock.averageCost} currency={product.stock.costCurrency} />
          </dd>
        </div>
      </dl>
      <p className="ro-note">
        <Icon name="lock" />
        <span>{t('variants.total_note')}</span>
      </p>

      <div className="v-count">
        <span>
          {t('variants.count', { count: variants.length })}
          {inactive > 0 && ` · ${t('variants.count_inactive', { count: inactive })}`}
        </span>
      </div>
      <div className="v-head v-head--read" aria-hidden="true">
        <span>{t('variants.col_variant')}</span>
        <span className="v-cols">
          <span>{t('products.sku')}</span>
          <span>{t('products.min_stock')}</span>
          <span className="r">{t('products.available')}</span>
        </span>
        <span />
      </div>
      <ul className="v-list" aria-label={t('variants.section')}>
        {variants.map((v) => (
          <li key={v.id}>
            {editingId === v.id ? (
              <VariantEditRow
                product={product}
                variant={v}
                unitShort={unitShort}
                onCancel={() => closeEdit(v.id)}
                onSaved={(saved) => {
                  applyVariantResult(saved)
                  const after = variantsOf(saved).find((x) => x.id === v.id) ?? v
                  toast({ text: t('variants.saved', { name: variantName(after) }) })
                  closeEdit(v.id)
                }}
                onReloaded={applyVariantResult}
                onStale={(e) => {
                  setEditingId(null)
                  onActionError(e)
                }}
              />
            ) : (
              <VariantReadRow
                variant={v}
                product={product}
                isAdmin={isAdmin}
                onEdit={() => setEditingId(v.id)}
                onToggle={() => toggle(v)}
              />
            )}
          </li>
        ))}
      </ul>

      {single && (
        <div className="card-foot">
          <p className="small muted">{t('variants.to_simple_hint')}</p>
          <button type="button" className="c-btn c-btn--secondary" onClick={askToSimple}>
            {t('variants.to_simple')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmSimple}
        title={t('variants.to_simple_title')}
        cancelLabel={t('common.cancel')}
        confirmLabel={<span>{t('variants.to_simple')}</span>}
        busy={convert.isPending}
        onCancel={() => setConfirmSimple(false)}
        onConfirm={toSimple}
      >
        {single && (
          <p>{t(single.active ? 'variants.to_simple_body' : 'variants.to_simple_body_inactive', { name: variantName(single) })}</p>
        )}
      </ConfirmDialog>
    </div>
  )
}

/** Una variante en modo lectura: título (+ «Inactiva»), SKU, mínimo y disponible, y sus botones. */
function VariantReadRow({
  variant: v,
  product,
  isAdmin,
  onEdit,
  onToggle,
}: {
  variant: VariantResponse
  product: ProductResponse
  isAdmin: boolean
  onEdit: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const name = variantName(v)
  // Etiquetas de stock ocultas hasta HU-04 (como en HU-02); la de «Inactiva» siempre.
  const badge = SHOW_STOCK_BADGES && product.active ? stockBadge(v) : null
  const hidden = <span className="sr-only">{name}</span>
  return (
    <div className={`v-row v-row--read${v.active ? '' : ' is-inactive'}`}>
      <div className="v-title">
        <span className="vt">{name}</span>
        {!v.active && <span className="c-badge c-badge--neutral">{t('variants.badge_inactive')}</span>}
        {badge && <span className={`c-badge c-badge--${badge.variant}`}>{t(badge.labelKey)}</span>}
      </div>
      <dl>
        <div>
          <dt>{t('products.sku')}</dt>
          <dd>{v.sku ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('products.min_stock')}</dt>
          <dd>{fmt.quantity(v.minStock, product.unit)}</dd>
        </div>
        <div>
          <dt>{t('products.available')}</dt>
          <dd className="r">{fmt.quantity(v.stock.available, product.unit)}</dd>
        </div>
      </dl>
      <div className="v-actions">
        {/* El espacio va FUERA del span oculto: nombre accesible «Editar M · Blanco» */}
        <button type="button" className="c-btn c-btn--secondary c-btn--sm" id={`v-${v.id}-edit`} onClick={onEdit}>
          {t('common.edit')} {hidden}
        </button>
        {isAdmin && (
          <button type="button" className="c-btn c-btn--secondary c-btn--sm" onClick={onToggle}>
            {t(v.active ? 'products.deactivate' : 'products.activate')} {hidden}
          </button>
        )}
      </div>
    </div>
  )
}
