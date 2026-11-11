import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/errors'
import { productsApi } from '../../api/products'
import { UNITS, type ProductResponse, type ProductType } from '../../api/types'
import { hasRole } from '../../auth/roles'
import { useCurrentUser } from '../../auth/useSession'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { FieldErrorText, listError, msg, useFieldErrorText } from '../../components/fieldMessage'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/toast'
import { DESKTOP_QUERY } from '../../components/useMediaQuery'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { useFocusAfterRender } from '../../components/useFocusAfterRender'
import { CURRENCIES } from '../../config/currencies'
import { useCategories, useRefreshCategories } from '../categories/queries'
import { categoryPath, productFormOptions } from '../categories/tree'
import { ConvertToVariantsCard } from './ConvertToVariantsCard'
import { DraftVariantList } from './DraftVariantList'
import { MoneyValue } from './MoneyValue'
import { useListPath } from './navigation'
import {
  buildProductFormSchema,
  isFormField,
  toFormValues,
  toRequest,
  toUpdateRequest,
  type ProductFormField,
  type ProductFormValues,
} from './productSchema'
import { productKeys, useProduct, useSaveProduct } from './queries'
import { isUnitLocked, LOCKED_UNIT, typeChangeNotes, usesApplianceFields, type TypeChangeNotes } from './typeRules'
import { useProductFormat } from './useProductFormat'
import { useToggleActive } from './useToggleActive'
import { VariantGenerator } from './VariantGenerator'
import { VariantsCard } from './VariantsCard'
import { generatorSizeId, firstAdded, mergeDrafts, mergeVariantData, rowErrorsFrom, type DraftVariant } from './variants'

/** Id del generador del alta (su campo «Tallas» es `gen-new-size`). */
const GEN_ID = 'gen-new'

/** `/products/new` → `null`; `/products/12/edit` → 12; un id raro → `NaN` (se trata como «no existe»). */
function parseId(raw: string | undefined): number | null {
  if (raw === undefined) return null
  return /^\d{1,15}$/.test(raw) ? Number(raw) : Number.NaN
}

/**
 * Pantalla de alta / edición (HU-02 CA-25, CA-9, CA-12, CA-14, CA-24; HU-15 CA-26). En una edición carga el producto
 * y, cuando llega, pinta el formulario. Ruta propia (no modal): el enlace se comparte y «atrás» funciona.
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
  // TT-14: si ya hay datos, el formulario se queda aunque falle un refetch en segundo plano (p. ej. al recuperar la
  // conexión). Si comprobáramos antes `isError`, React desmontaría el formulario y se perdería lo escrito.
  else if (product.data) body = <ProductForm key={product.data.id} product={product.data} listPath={listPath} />
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

interface ProductFormProps {
  /** `null` en un alta. */
  product: ProductResponse | null
  listPath: string
}

/** Una opción del selector de categoría. */
interface CategoryOption {
  id: number
  label: string
  type: ProductType
}

const NO_NOTES: TypeChangeNotes = { dropsApplianceFields: false, unitLockedBy: null }

function ProductForm({ product, listPath }: ProductFormProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const fmt = useProductFormat()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isAdmin = hasRole(useCurrentUser(), 'ADMIN')
  const categories = useCategories()
  const refreshCategories = useRefreshCategories()
  const errorText = useFieldErrorText()

  /** El producto tal como lo conoce el servidor (versión, estado, stock). Cambia al activar/desactivar o recargar. */
  const [current, setCurrent] = useState(product)
  const [submitError, setSubmitError] = useState<UiMessage | null>(null)
  const [versionConflict, setVersionConflict] = useState(false)
  /** Aviso del último cambio de tipo (se guarda QUÉ pasó, no el texto: así cambia con el idioma). */
  const [notes, setNotes] = useState<TypeChangeNotes>(NO_NOTES)
  const conflictRef = useRef<HTMLDivElement>(null)
  /** HU-16 CA-21: la casilla «Tiene tallas o colores» sigue a la categoría (Ropa → marcada) hasta que el usuario la toca. */
  const [hasVariantsTouched, setHasVariantsTouched] = useState(false)
  /** Tras convertir un simple en «con variantes», se abre «Añadir variantes» (ux-notes products-v2 §4). */
  const [openAddVariants, setOpenAddVariants] = useState(false)
  /** Diálogo «Guarda antes los cambios del producto» (convertir con el formulario a medias). */
  const [saveFirst, setSaveFirst] = useState(false)
  const focusAfter = useFocusAfterRender()

  // ----- Opciones del selector de categoría (CA-26): activas + la actual si está inactiva -----
  const currentCategory = current?.category ?? null
  const options = useMemo<CategoryOption[]>(() => {
    const list = productFormOptions(categories.data ?? [], currentCategory?.id ?? null, lang).map((c) => ({
      id: c.id,
      label: c.active ? categoryPath(c, lang) : t('products.category_inactive_suffix', { path: categoryPath(c, lang) }),
      type: c.productType,
    }))
    // Mientras cargan las categorías (o si fallan), la del producto sigue ahí: el formulario no se queda sin valor.
    if (current && !list.some((o) => o.id === current.category.id)) {
      const c = current.category
      const path = categoryPath(c, lang)
      list.unshift({ id: c.id, label: c.active ? path : t('products.category_inactive_suffix', { path }), type: current.type })
    }
    return list
  }, [categories.data, current, currentCategory?.id, lang, t])

  /** Tipo de la categoría elegida (`null` si aún no hay). Lo usan el esquema, la vista y `toRequest`. */
  const typeOf = useCallback(
    (categoryId: string): ProductType | null => options.find((o) => String(o.id) === categoryId)?.type ?? null,
    [options],
  )
  // El esquema depende del tipo: se rehace solo cuando cambian las opciones (useMemo = "cachear un cálculo").
  const mode = product ? 'edit' : 'create'
  const resolver = useMemo(() => zodResolver(buildProductFormSchema(typeOf, mode)), [typeOf, mode])

  // React Hook Form: el formulario. `mode: 'onTouched'` = valida al salir de cada campo y, desde entonces,
  // en cada cambio (el error se quita en cuanto el valor es válido). Al enviar valida todo y enfoca el primer error.
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
    setFocus,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver,
    defaultValues: toFormValues(product, lang),
    mode: 'onTouched',
  })
  const unit = useWatch({ control, name: 'unit' })
  const currency = useWatch({ control, name: 'salePriceCurrency' })
  const categoryId = useWatch({ control, name: 'categoryId' })
  const hasVariants = useWatch({ control, name: 'hasVariants' })
  // CAMPOS DINÁMICOS (HU-16): las filas generadas del alta son una lista dentro del formulario. `fields` trae una
  // clave estable por fila (`id`) para React; `useWatch` da sus valores actuales (lo escrito en cada SKU/mínimo).
  const { fields: draftFields, replace: replaceDrafts, remove: removeDraft } = useFieldArray({ control, name: 'variants' })
  const draftRows = useWatch({ control, name: 'variants' })
  const type = typeOf(categoryId)
  const unitLocked = isUnitLocked(type)
  const shownUnit = unitLocked ? LOCKED_UNIT : unit
  const unitShort = shownUnit ? t(`unit_short.${shownUnit}`) : ''

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

  /**
   * Al elegir otra categoría (SELECTS DEPENDIENTES: la categoría decide qué otros campos hay).
   * `type` todavía es el de ANTES del cambio: esta función se creó en la pintada anterior.
   */
  const onCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = typeOf(e.target.value)
    setNotes(type === next ? NO_NOTES : typeChangeNotes(type, next, getValues()))
    if (isUnitLocked(next)) {
      setValue('unit', LOCKED_UNIT, { shouldDirty: true })
      clearErrors('unit')
    }
    // HU-16 CA-21: en un alta, la ropa viene con «Tiene tallas o colores» marcada… salvo que el usuario ya la tocara.
    if (!current && !hasVariantsTouched) setValue('hasVariants', next === 'CLOTHING')
  }

  /** El generador del alta añade filas: sin duplicar, en el orden de la API, y el foco a la primera nueva. */
  const onGenerate = (added: DraftVariant[]) => {
    const merged = mergeDrafts(getValues('variants'), added)
    replaceDrafts(merged)
    const first = firstAdded(merged, added)
    focusAfter(() => document.getElementById(`draft-${first?.key}-sku`))
  }
  const focusGenerator = useCallback(() => document.getElementById(generatorSizeId(GEN_ID))?.focus(), [])

  /** Errores del servidor → en su campo cuando se puede (CA-25), si no, alerta arriba. */
  const handleSaveError = (e: unknown, values: ProductFormValues) => {
    if (isApiError(e) && e.kind === 'http') {
      const serverError = (field: ProductFormField, message: string | undefined, focus = true) =>
        setError(field, { type: 'server', message: message ?? t('net.unexpected_generic') }, { shouldFocus: focus })
      // HU-16 CA-21: alta con variantes → el error va a la fila que lo provocó, si se puede saber.
      if (!current && values.hasVariants) {
        const rows = rowErrorsFrom(e, values.variants)
        rows.forEach((r, i) =>
          setError(
            `variants.${r.index}.${r.field === 'options' ? 'size' : r.field}`,
            { type: 'server', message: r.message || t('net.unexpected_generic') },
            { shouldFocus: i === 0 && r.field !== 'options' },
          ),
        )
        if (rows.length > 0) return
      }
      switch (e.code) {
        case 'product.sku_conflict':
          if (values.hasVariants) break // con variantes no hay campo SKU del producto: alerta arriba
          return serverError('sku', e.detail)
        case 'resource.version_conflict':
          return setVersionConflict(true)
        case 'product.price_currency_mismatch':
        case 'product.currency_unsupported':
          return serverError('salePrice', e.detail)
        case 'product.category_not_found':
        case 'category.inactive':
          // Otro ADMIN la desactivó mientras tanto: se dice en el campo y el selector se pone al día (CA-13).
          void refreshCategories()
          return setError('categoryId', { type: 'validate', message: msg('api.category.inactive') }, { shouldFocus: true })
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
    const valuesType = typeOf(values.categoryId)
    save.mutate(
      current
        ? { id: current.id, body: toUpdateRequest(values, valuesType, current.version) }
        : { id: null, body: toRequest(values, valuesType) },
      {
        onSuccess: (saved) => {
          toast({ text: current ? t('products.saved') : t('products.created', { name: saved.name }) })
          navigate(listPath, { state: { saved: true } })
        },
        onError: (e) => handleSaveError(e, values),
      },
    )
  }
  /** Si el único error es «añade al menos una variante», no hay campo que enfocar: el foco va a «Tallas». */
  const onInvalid = (formErrors: FieldErrors<ProductFormValues>) => {
    const keys = Object.keys(formErrors)
    const v = formErrors.variants
    if (keys.length === 1 && keys[0] === 'variants' && (v?.root || v?.message)) focusGenerator()
  }
  const submit = handleSubmit(onSubmit, onInvalid)

  /** CA-9: tras un conflicto de versión, recargar el producto (lo escrito se pierde, aceptado en Sprint 1). */
  const reload = async () => {
    if (!current) return
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: productKeys.detail(current.id),
        queryFn: ({ signal }) => productsApi.get(current.id, signal),
        staleTime: 0,
      })
      replaceProduct(fresh)
    } catch (e) {
      setSubmitError(messageForError(e))
    }
  }

  /** El producto cambió de versión (recarga o conversión): estado y formulario empiezan de nuevo con él. */
  const replaceProduct = (fresh: ProductResponse, openAdd = false) => {
    setCurrent(fresh)
    reset(toFormValues(fresh, lang))
    setNotes(NO_NOTES)
    setVersionConflict(false)
    setSubmitError(null)
    setOpenAddVariants(openAdd)
  }
  /** Convertido simple ↔ con variantes (CA-12/13): la versión subió y el formulario estaba sin cambios. */
  const onConverted = (fresh: ProductResponse) => replaceProduct(fresh, fresh.hasVariants)
  /**
   * Respuesta de una operación de VARIANTE: lista, contador y stock al día, pero la versión del formulario NO cambia
   * (CA-13b). Actualización FUNCIONAL (`c => …`): parte del estado más reciente aunque la respuesta llegue tarde
   * (p. ej. el «Deshacer» de un aviso).
   */
  const onVariantResult = (fromApi: ProductResponse) => setCurrent((c) => (c ? mergeVariantData(c, fromApi) : c))

  /** Atributos de accesibilidad de un campo: error marcado y ayuda + error leídos por el lector de pantalla. */
  const a11y = (name: ProductFormField, describedBy: string[] = [`f-${name}-help`]) => ({
    id: `f-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': [...describedBy, errors[name] ? `f-${name}-error` : ''].filter(Boolean).join(' ') || undefined,
  })
  const fieldError = (name: ProductFormField) => <FieldErrorText id={`f-${name}-error`} text={errorText(errors[name])} />
  const hint = (required: boolean) => <span className="hint">{t(required ? 'common.required' : 'common.optional')}</span>

  const currencyOptions = currency && !(CURRENCIES as readonly string[]).includes(currency) ? [...CURRENCIES, currency] : CURRENCIES
  const busy = save.isPending
  const typeName = type ? t(`product_type.${type}`) : ''
  const lockedName = notes.unitLockedBy ? t(`product_type.${notes.unitLockedBy}`) : ''

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

            {/* Categoría a ancho completo: las rutas («Electrodomésticos › Cocina › Ollas») son largas */}
            <div className="c-field">
              <label className="c-label" htmlFor="f-categoryId">
                {t('products.category')} {hint(true)}
              </label>
              <select
                className="c-select"
                {...a11y('categoryId', type ? ['f-categoryId-type', 'f-categoryId-help'] : ['f-categoryId-help'])}
                {...register('categoryId', { onChange: onCategoryChange })}
              >
                <option value="">{t('products.category_placeholder')}</option>
                {options.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.label}
                  </option>
                ))}
              </select>
              {type && (
                <p className="type-line" id="f-categoryId-type">
                  <span className="c-tag">{t('products.type_tag', { type: typeName })}</span>
                </p>
              )}
              <p className="c-help" id="f-categoryId-help">
                {t('products.category_help')}
              </p>
              {fieldError('categoryId')}
              {categories.isError && (
                <ErrorAlert message={messageForError(categories.error)} onRetry={() => void categories.refetch()} />
              )}
              {/* Región viva: el lector de pantalla anuncia lo que cambia al elegir otro tipo */}
              <div role="status">
                {(notes.dropsApplianceFields || notes.unitLockedBy) && (
                  <div className="c-alert c-alert--warning c-alert--sm">
                    <Icon name="info" />
                    <ul className="plain-list">
                      {notes.dropsApplianceFields && <li>{t('products.type_change_attrs')}</li>}
                      {notes.unitLockedBy && (
                        <li>{t('products.type_change_unit', { unit: t(`unit.${LOCKED_UNIT}`), type: lockedName })}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="grid-2">
              <div className="c-field">
                <label className="c-label" htmlFor="f-brand">
                  {t('products.brand')} {hint(false)}
                </label>
                <input className="c-input" autoComplete="off" maxLength={80} {...a11y('brand', [])} {...register('brand')} />
                {fieldError('brand')}
              </div>

              <div className="c-field">
                <label className="c-label" htmlFor="f-unit">
                  {t('products.unit')} {hint(true)}
                </label>
                {/* Con el tipo que la fija, se ve «Unidad (u)» deshabilitada y la ayuda explica por qué (CA-17) */}
                <select className="c-select" {...a11y('unit')} {...register('unit')} disabled={unitLocked}>
                  <option value="">{t('products.unit_placeholder')}</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(`unit.${u}`)}
                    </option>
                  ))}
                </select>
                <p className="c-help" id="f-unit-help">
                  {unitLocked ? t('products.unit_locked_help', { type: typeName }) : t('products.unit_help')}
                </p>
                {fieldError('unit')}
              </div>
            </div>

            {/* Solo electrodomésticos (CA-16). Si se cambia a otro tipo, los valores quedan ocultos (no se envían)
                y reaparecen si se vuelve a un electrodoméstico. */}
            {usesApplianceFields(type) && (
              <div className="grid-2">
                <div className="c-field">
                  <label className="c-label" htmlFor="f-model">
                    {t('products.model')} {hint(false)}
                  </label>
                  <input
                    className="c-input"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={80}
                    {...a11y('model')}
                    {...register('model')}
                  />
                  <p className="c-help" id="f-model-help">
                    {t('products.model_help')}
                  </p>
                  {fieldError('model')}
                </div>
                <div className="c-field">
                  <label className="c-label" htmlFor="f-warrantyMonths">
                    {t('products.warranty')} {hint(false)}
                  </label>
                  <div className="c-input-group">
                    <input
                      className="c-input num"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={3}
                      {...a11y('warrantyMonths')}
                      {...register('warrantyMonths')}
                    />
                    <span className="suffix" aria-hidden="true">
                      {t('products.months')}
                    </span>
                  </div>
                  <p className="c-help" id="f-warrantyMonths-help">
                    {t('products.warranty_help')}
                  </p>
                  {fieldError('warrantyMonths')}
                </div>
              </div>
            )}

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
                  <select className="c-select" {...a11y('salePriceCurrency', [])} {...register('salePriceCurrency')}>
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

        {/* «Inventario» (prototipo products-v2): SKU y stock mínimo, o (alta con variantes) el generador y sus filas.
            Un producto con variantes en edición no la tiene: sus variantes van en su propia tarjeta (CA-22). */}
        {!(current && current.hasVariants) && (
        <div className="card">
          <h2>{t('products.section_inventory')}</h2>
          <div className="fields">
            {!current && (
              // Casilla nativa, no interruptor: el cambio se aplica al «Guardar», no al tocarla (ux-notes §4).
              <div className="c-field">
                <label className="c-check">
                  <input
                    type="checkbox"
                    aria-describedby="f-hasVariants-help"
                    {...register('hasVariants', { onChange: () => setHasVariantsTouched(true) })}
                  />{' '}
                  <span>{t('products.has_variants')}</span>
                </label>
                <p className="c-help" id="f-hasVariants-help">
                  {t('products.has_variants_help')}
                </p>
              </div>
            )}
            {hasVariants ? (
              // Las filas generadas no se pierden si se desmarca y se vuelve a marcar (solo se envían si está marcada).
              <div>
                <VariantGenerator
                  idPrefix={GEN_ID}
                  existing={draftRows ?? []}
                  takenSkus={(draftRows ?? []).map((r) => r.sku)}
                  unitShort={unitShort}
                  onApply={onGenerate}
                />
                <div className="v-count">
                  <span role="status">{draftFields.length > 0 ? t('variants.count', { count: draftFields.length }) : ''}</span>
                </div>
                <DraftVariantList
                  idPrefix="draft"
                  rows={draftFields.map((f, i) => ({ ...(draftRows?.[i] ?? f), fieldId: f.id }))}
                  label={t('variants.count', { count: draftFields.length })}
                  unitShort={unitShort}
                  registerField={(i, field) =>
                    register(`variants.${i}.${field}`, {
                      onBlur:
                        field === 'sku'
                          ? (e: FocusEvent<HTMLInputElement>) =>
                              setValue(`variants.${i}.sku`, e.target.value.trim().toUpperCase(), {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                          : undefined,
                    })
                  }
                  errorOf={(i, field) => errorText(errors.variants?.[i]?.[field === 'options' ? 'size' : field])}
                  onRemove={removeDraft}
                  focusWhenEmpty={focusGenerator}
                />
                <FieldErrorText
                  id="f-variants-error"
                  text={errorText(listError(errors.variants))}
                />
                <p className="c-help">{t('products.stock_new_note_variants')}</p>
              </div>
            ) : (
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
                <label className="c-label" htmlFor="f-minStock">
                  {t('products.min_stock')} {hint(true)}
                </label>
                <div className="c-input-group">
                  <input className="c-input num" inputMode="decimal" autoComplete="off" {...a11y('minStock')} {...register('minStock')} />
                  <span className="suffix" aria-hidden="true">
                    {shownUnit ? t(`unit_short.${shownUnit}`) : ''}
                  </span>
                </div>
                <p className="c-help" id="f-minStock-help">
                  {t('products.min_stock_help')}
                </p>
                {fieldError('minStock')}
              </div>
            </div>
            )}
            {!current && !hasVariants && <p className="c-help">{t('products.stock_new_note')}</p>}
          </div>
        </div>
        )}

        {current && !current.hasVariants && (
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
                <dd><MoneyValue amount={current.stock.averageCost} currency={current.stock.costCurrency} /></dd>
              </div>
            </dl>
            <p className="ro-note">
              <Icon name="lock" />
              <span>{t('products.stock_readonly_note')}</span>
            </p>
          </div>
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

      {/* HU-16: tallas y colores. Fuera del formulario: se guarda al momento, como el estado del producto. */}
      {current &&
        (current.hasVariants ? (
          <VariantsCard
            product={current}
            isAdmin={isAdmin}
            formDirty={isDirty}
            openAddOnMount={openAddVariants}
            onVariantResult={onVariantResult}
            onConverted={onConverted}
            onStale={() => void reload()}
            onSaveFirst={() => setSaveFirst(true)}
          />
        ) : (
          <ConvertToVariantsCard
            product={current}
            formDirty={isDirty}
            onConverted={onConverted}
            onStale={() => void reload()}
            onSaveFirst={() => setSaveFirst(true)}
          />
        ))}

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
      {/* Convertir con cambios sin guardar: la conversión recargaría el producto y se perdería lo escrito (CA-22) */}
      <ConfirmDialog
        open={saveFirst}
        title={t('variants.save_first_title')}
        confirmLabel={t('common.got_it')}
        onCancel={() => setSaveFirst(false)}
        onConfirm={() => setSaveFirst(false)}
      >
        <p>{t('variants.save_first_body')}</p>
      </ConfirmDialog>
    </div>
  )
}
