import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { useForm, useWatch, type FieldError as RhfFieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/errors'
import { productsApi } from '../../api/products'
import { UNITS, type ProductResponse } from '../../api/types'
import { hasRole } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useSession'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/toast'
import { DESKTOP_QUERY } from '../../components/useMediaQuery'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { useListPath } from './navigation'
import {
  CURRENCIES,
  isFormField,
  parseMsg,
  productFormSchema,
  toFormValues,
  toRequest,
  type ProductFormField,
  type ProductFormValues,
} from './productSchema'
import { productKeys, useCategories, useProduct, useSaveProduct } from './queries'
import { useProductFormat } from './useProductFormat'
import { useToggleActive } from './useToggleActive'

/** `/products/new` → `null`; `/products/12/edit` → 12; un id raro → `NaN` (se trata como «no existe»). */
function parseId(raw: string | undefined): number | null {
  if (raw === undefined) return null
  return /^\d{1,15}$/.test(raw) ? Number(raw) : Number.NaN
}

/**
 * Pantalla de alta / edición (HU-02 CA-25, CA-9, CA-12, CA-14, CA-24). En una edición carga el producto y,
 * cuando llega, pinta el formulario. Ruta propia (no modal): el enlace se comparte y «atrás» funciona.
 */
export default function ProductFormPage() {
  const { t } = useTranslation()
  const id = parseId(useParams().id)
  const listPath = useListPath()
  const isNew = id === null
  useDocumentTitle('products.page_title')
  const product = useProduct(isNew || Number.isNaN(id) ? null : id)

  const notFound =
    Number.isNaN(id) || (product.isError && isApiError(product.error) && product.error.code === 'product.not_found')

  let body: ReactNode
  if (isNew) body = <ProductForm product={null} listPath={listPath} />
  else if (notFound)
    body = (
      <section className="c-empty">
        <Icon name="empty" />
        <h2>{t('products.not_found_title')}</h2>
        <p>{t('products.not_found_body')}</p>
        <Link className="c-btn c-btn--secondary" to={listPath}>
          {t('products.back_to_list')}
        </Link>
      </section>
    )
  else if (product.isError)
    body = <ErrorAlert message={messageForError(product.error)} onRetry={() => void product.refetch()} />
  else if (product.data) body = <ProductForm key={product.data.id} product={product.data} listPath={listPath} />
  else body = <div className="spinner spinner--lg" role="status" aria-label={t('common.loading')} />

  return (
    <>
      <Link className="back-link desktop-only" to={listPath}>
        <Icon name="left" />
        <span>{t('products.back_to_list')}</span>
      </Link>
      {body}
    </>
  )
}

/** Texto de un error de campo: los nuestros son claves (con variables); los del servidor ya vienen traducidos. */
function useFieldErrorText() {
  const { t } = useTranslation()
  return (error: RhfFieldError | undefined): string | null => {
    if (!error?.message) return null
    if (error.type === 'server') return error.message
    const { key, vars } = parseMsg(error.message)
    return t(key, vars ?? {})
  }
}

interface ProductFormProps {
  /** `null` en un alta. */
  product: ProductResponse | null
  listPath: string
}

function ProductForm({ product, listPath }: ProductFormProps) {
  const { t, i18n } = useTranslation()
  const fmt = useProductFormat()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isAdmin = hasRole(useCurrentUser(), 'ADMIN')
  const categories = useCategories()
  const errorText = useFieldErrorText()

  /** El producto tal como lo conoce el servidor (versión, estado, stock). Cambia al activar/desactivar o recargar. */
  const [current, setCurrent] = useState(product)
  const [submitError, setSubmitError] = useState<UiMessage | null>(null)
  const [versionConflict, setVersionConflict] = useState(false)
  const conflictRef = useRef<HTMLDivElement>(null)

  // React Hook Form: el formulario. `mode: 'onTouched'` = valida al salir de cada campo y, desde entonces,
  // en cada cambio (el error se quita en cuanto el valor es válido). Al enviar valida todo y enfoca el primer error.
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product, i18n.language),
    mode: 'onTouched',
  })
  const unit = useWatch({ control, name: 'unit' })
  const currency = useWatch({ control, name: 'salePriceCurrency' })

  const save = useSaveProduct()
  const { toggle, dialog: toggleDialog } = useToggleActive((saved) => setCurrent(saved))

  // ¿Salir con cambios sin guardar? `useBlocker` intercepta CUALQUIER navegación dentro de la app
  // (Cancelar, Volver, el menú, el botón atrás) y nos deja preguntar antes. Como un interceptor de Spring MVC.
  // Tras guardar bien navegamos con `{ saved: true }` en el estado: esa salida no pregunta.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !(nextLocation.state as { saved?: boolean } | null)?.saved &&
      currentLocation.pathname !== nextLocation.pathname,
  )
  // Y si se cierra o recarga la pestaña, el aviso nativo del navegador.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // En escritorio, el foco empieza en «Nombre» (en móvil abriría el teclado sin pedirlo).
  useEffect(() => {
    if (window.matchMedia?.(DESKTOP_QUERY).matches) setFocus('name')
  }, [setFocus])

  useEffect(() => {
    if (versionConflict) conflictRef.current?.scrollIntoView?.({ block: 'start' })
  }, [versionConflict])

  /** Errores del servidor → en su campo cuando se puede (CA-25), si no, alerta arriba. */
  const handleSaveError = (e: unknown) => {
    if (isApiError(e) && e.kind === 'http') {
      const serverError = (field: ProductFormField, message: string | undefined, focus = true) =>
        setError(field, { type: 'server', message: message ?? t('net.unexpected_generic') }, { shouldFocus: focus })
      switch (e.code) {
        case 'product.sku_conflict':
          return serverError('sku', e.detail)
        case 'resource.version_conflict':
          return setVersionConflict(true)
        case 'product.price_currency_mismatch':
        case 'product.currency_unsupported':
          return serverError('salePrice', e.detail)
        case 'validation.failed': {
          const fields = Object.entries(e.errors ?? {}).filter(([f]) => isFormField(f))
          fields.forEach(([f, m], i) => serverError(f as ProductFormField, m, i === 0))
          if (fields.length > 0) return
        }
      }
    }
    setSubmitError(messageForError(e))
  }

  const onSubmit = (values: ProductFormValues) => {
    if (save.isPending) return // un doble clic no guarda dos veces
    setSubmitError(null)
    setVersionConflict(false)
    save.mutate(
      { id: current?.id ?? null, body: toRequest(values), version: current?.version },
      {
        onSuccess: (saved) => {
          toast({ text: current ? t('products.saved') : t('products.created', { name: saved.name }) })
          navigate(listPath, { state: { saved: true } })
        },
        onError: handleSaveError,
      },
    )
  }
  const submit = handleSubmit(onSubmit)

  /** CA-9: tras un conflicto de versión, recargar el producto (lo escrito se pierde, aceptado en Sprint 1). */
  const reload = async () => {
    if (!current) return
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: productKeys.detail(current.id),
        queryFn: ({ signal }) => productsApi.get(current.id, signal),
        staleTime: 0,
      })
      setCurrent(fresh)
      reset(toFormValues(fresh, i18n.language))
      setVersionConflict(false)
      setSubmitError(null)
    } catch (e) {
      setSubmitError(messageForError(e))
    }
  }

  /** Atributos de accesibilidad de un campo: error marcado y ayuda + error leídos por el lector de pantalla. */
  const a11y = (name: ProductFormField, withHelp = true) => ({
    id: `f-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': [withHelp ? `f-${name}-help` : '', errors[name] ? `f-${name}-error` : ''].filter(Boolean).join(' ') || undefined,
  })
  const fieldError = (name: ProductFormField) => {
    const text = errorText(errors[name])
    return text ? (
      <p className="c-error" id={`f-${name}-error`}>
        <Icon name="alert" />
        <span>{text}</span>
      </p>
    ) : null
  }
  const hint = (required: boolean) => <span className="hint">{t(required ? 'common.required' : 'common.optional')}</span>

  const currencyOptions = currency && !(CURRENCIES as readonly string[]).includes(currency) ? [...CURRENCIES, currency] : CURRENCIES
  const busy = save.isPending

  return (
    <div className="form-layout">
      <div className="page-head">
        <h1 className="mobile-sr">
          {t(current ? 'products.edit_title' : 'products.new')}
          {current && !current.active && <span className="c-badge c-badge--neutral">{t('products.badge_inactive')}</span>}
        </h1>
      </div>

      <div className="alerts" ref={conflictRef}>
        {versionConflict && (
          <Alert
            variant="danger"
            title={t('products.version_conflict_title')}
            action={
              <button type="button" className="c-btn c-btn--secondary" onClick={() => void reload()}>
                {t('products.reload')}
              </button>
            }
          >
            {t('products.version_conflict_body')}
          </Alert>
        )}
        {submitError && <ErrorAlert message={submitError} onRetry={() => void submit()} />}
      </div>

      <form className="form-layout" onSubmit={submit} noValidate>
        <div className="card">
          <h2>{t('products.section_data')}</h2>
          <div className="fields">
            <div className="c-field">
              <label className="c-label" htmlFor="f-name">
                {t('products.name')} {hint(true)}
              </label>
              <input className="c-input" autoComplete="off" maxLength={120} {...a11y('name')} {...register('name')} />
              <p className="c-help" id="f-name-help">
                {t('products.name_help')}
              </p>
              {fieldError('name')}
            </div>

            <div className="grid-2">
              <div className="c-field">
                <label className="c-label" htmlFor="f-sku">
                  {t('products.sku')} {hint(false)}
                </label>
                <input
                  className="c-input"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={50}
                  {...a11y('sku')}
                  {...register('sku', {
                    // Al salir, en mayúsculas: el usuario ve lo que guardará el backend (CA-2).
                    onBlur: (e: FocusEvent<HTMLInputElement>) =>
                      setValue('sku', e.target.value.trim().toUpperCase(), { shouldValidate: true, shouldDirty: true }),
                  })}
                />
                <p className="c-help" id="f-sku-help">
                  {t('products.sku_help')}
                </p>
                {fieldError('sku')}
              </div>

              <div className="c-field">
                <label className="c-label" htmlFor="f-category">
                  {t('products.category')} {hint(false)}
                </label>
                {/* <datalist> nativo: autocompleta las existentes sin librerías y permite escribir una nueva (CA-22) */}
                <input
                  className="c-input"
                  autoComplete="off"
                  maxLength={50}
                  list="f-category-list"
                  {...a11y('category')}
                  {...register('category')}
                />
                <datalist id="f-category-list">
                  {(categories.data ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="c-help" id="f-category-help">
                  {t('products.category_help')}
                </p>
                {fieldError('category')}
              </div>
            </div>

            <div className="grid-2">
              <div className="c-field">
                <label className="c-label" htmlFor="f-unit">
                  {t('products.unit')} {hint(true)}
                </label>
                <select className="c-select" {...a11y('unit')} {...register('unit')}>
                  <option value="">{t('products.unit_placeholder')}</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(`unit.${u}`)}
                    </option>
                  ))}
                </select>
                <p className="c-help" id="f-unit-help">
                  {t('products.unit_help')}
                </p>
                {fieldError('unit')}
              </div>

              <div className="c-field">
                <label className="c-label" htmlFor="f-minStock">
                  {t('products.min_stock')} {hint(true)}
                </label>
                <div className="c-input-group">
                  <input className="c-input num" inputMode="decimal" autoComplete="off" {...a11y('minStock')} {...register('minStock')} />
                  <span className="suffix" aria-hidden="true">
                    {unit ? t(`unit_short.${unit}`) : ''}
                  </span>
                </div>
                <p className="c-help" id="f-minStock-help">
                  {t('products.min_stock_help')}
                </p>
                {fieldError('minStock')}
              </div>
            </div>

            <fieldset aria-describedby="f-salePrice-help">
              <legend>
                {t('products.sale_price')} {hint(false)}
              </legend>
              <div className="price-row">
                <div className="c-field">
                  <label className="sr-only" htmlFor="f-salePrice">
                    {t('products.amount')}
                  </label>
                  <input className="c-input num" inputMode="decimal" autoComplete="off" {...a11y('salePrice')} {...register('salePrice')} />
                </div>
                <div className="c-field">
                  <label className="sr-only" htmlFor="f-salePriceCurrency">
                    {t('products.currency')}
                  </label>
                  <select className="c-select" {...a11y('salePriceCurrency', false)} {...register('salePriceCurrency')}>
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="c-help" id="f-salePrice-help">
                {t('products.sale_price_help')}
              </p>
              {fieldError('salePrice')}
            </fieldset>
          </div>
        </div>

        {current ? (
          // Solo lectura: texto, nunca inputs, para que nadie intente cambiarlo (CA-7, CA-25).
          <div className="card">
            <h2>{t('products.section_stock')}</h2>
            <dl className="ro-grid">
              <div>
                <dt>{t('products.on_hand')}</dt>
                <dd>{fmt.quantity(current.stock.onHand, current.unit)}</dd>
              </div>
              <div>
                <dt>{t('products.reserved')}</dt>
                <dd>{fmt.quantity(current.stock.reserved, current.unit)}</dd>
              </div>
              <div>
                <dt>{t('products.available')}</dt>
                <dd>{fmt.quantity(current.stock.available, current.unit)}</dd>
              </div>
              <div>
                <dt>{t('products.avg_cost')}</dt>
                <dd>{fmt.money(current.stock.averageCost, current.stock.costCurrency)}</dd>
              </div>
            </dl>
            <p className="ro-note">
              <Icon name="lock" />
              <span>{t('products.stock_readonly_note')}</span>
            </p>
          </div>
        ) : (
          <p className="c-help">{t('products.stock_new_note')}</p>
        )}

        <div className="btn-bar">
          <Link className="c-btn c-btn--secondary" to={listPath}>
            {t('common.cancel')}
          </Link>
          <button className="c-btn c-btn--primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy && <span className="spinner" aria-hidden="true" />}
            <span>{t(busy ? 'common.saving' : 'products.save')}</span>
          </button>
        </div>
      </form>

      {current && isAdmin && (
        // Separado del formulario: cambiar el estado no depende de «Guardar» (CA-24: solo ADMIN).
        <div className="card status-card">
          <div>
            <h2>{t('products.section_status')}</h2>
            <p className="muted small">
              {t(current.active ? 'products.status_text_active' : 'products.status_text_inactive')}
            </p>
          </div>
          <button type="button" className="c-btn c-btn--secondary" onClick={() => toggle(current)}>
            {t(current.active ? 'products.deactivate_product' : 'products.activate_product')}
          </button>
        </div>
      )}

      {current && (
        <p className="audit">
          {t('products.audit', {
            createdBy: current.createdBy ?? '—',
            createdAt: fmt.dateTime(current.createdAt),
            updatedBy: current.updatedBy ?? '—',
            updatedAt: fmt.dateTime(current.updatedAt),
          })}
        </p>
      )}

      {toggleDialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('products.discard_title')}
        cancelLabel={t('products.keep_editing')}
        confirmLabel={t('products.discard')}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        <p>{t('products.discard_body')}</p>
      </ConfirmDialog>
    </div>
  )
}
