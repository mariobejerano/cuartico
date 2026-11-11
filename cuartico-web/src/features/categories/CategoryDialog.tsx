import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { categoriesApi } from '../../api/categories'
import { isApiError } from '../../api/errors'
import { PRODUCT_TYPES, type CategoryResponse } from '../../api/types'
import { Alert } from '../../components/Alert'
import { ErrorAlert } from '../../components/ErrorAlert'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { FieldErrorText, msg, useFieldErrorText } from '../../components/fieldMessage'
import { Icon } from '../../components/Icon'
import { ServerWakingNotice } from '../../components/ServerWakingNotice'
import {
  buildCategorySchema,
  effectiveParentId,
  nameConflictMessage,
  NAME_MAX,
  toCreateRequest,
  toFormValues,
  toUpdateRequest,
  type CategoryFormValues,
} from './categorySchema'
import { categoryKeys, useCreateCategory, useRefreshCategories, useRenameCategory } from './queries'
import {
  categoryName,
  categoryPath,
  findSimilar,
  parentOptions,
  rootOf,
  siblingsOf,
  upsertCategory,
  type CategoryIndex,
} from './tree'

type Field = keyof CategoryFormValues
const FIELDS: readonly Field[] = ['parentId', 'productType', 'name', 'nameEn']

interface CategoryDialogProps {
  index: CategoryIndex
  /** `null` = «Nueva categoría»; si no, «Renombrar» esa categoría. */
  editing: CategoryResponse | null
  /** Padre preseleccionado al venir de «Añadir subcategoría». */
  initialParentId: number | null
  onSaved: (saved: CategoryResponse, created: boolean) => void
  onClose: () => void
}

/**
 * Un solo diálogo para crear (raíz o subcategoría) y para renombrar (notas de UX §3).
 * Se MONTA al abrirse y se desmonta al cerrarse: así cada apertura empieza con el formulario limpio.
 * `<dialog>` nativo: el navegador atrapa el foco, cierra con Escape y devuelve el foco al botón que lo abrió.
 */
export function CategoryDialog({ index, editing, initialParentId, onSaved, onClose }: CategoryDialogProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const queryClient = useQueryClient()
  const refreshCategories = useRefreshCategories()
  const errorText = useFieldErrorText()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  /** La categoría que se renombra, tal como la conoce el servidor (cambia al «Recargar categoría»). */
  const [current, setCurrent] = useState(editing)
  const [alert, setAlert] = useState<UiMessage | null>(null)
  const [versionConflict, setVersionConflict] = useState(false)
  /** Guardado con éxito: lo cierra el efecto de abajo (los refs no se leen desde lo que se prepara al pintar). */
  const [saved, setSaved] = useState(false)

  const ctx = useMemo(() => ({ index, lang, editing: current }), [index, lang, current])
  const resolver = useMemo(() => zodResolver(buildCategorySchema(ctx)), [ctx])
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    trigger,
    getValues,
    reset,
    control,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver,
    defaultValues: toFormValues(editing, initialParentId),
    mode: 'onTouched',
  })

  const create = useCreateCategory()
  const rename = useRenameCategory()
  const busy = create.isPending || rename.isPending

  // Al montarse: se abre como modal y el foco va a donde tiene sentido. Con «Añadir subcategoría» el padre ya
  // está elegido, así que va directo al nombre (2 toques + escribir).
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    setFocus(!editing && initialParentId === null ? 'parentId' : 'name')
  }, [editing, initialParentId, setFocus])

  const close = () => ref.current?.close() // dispara el evento `close` → `onClose`
  useEffect(() => {
    if (saved) ref.current?.close()
  }, [saved])

  // SELECTS DEPENDIENTES: el padre elegido decide si se pide el tipo o se muestra heredado, y contra qué hermanas
  // se comprueba el nombre.
  const rawParentId = useWatch({ control, name: 'parentId' })
  const name = useWatch({ control, name: 'name' })
  const parentId = effectiveParentId({ parentId: rawParentId }, ctx)
  const parent = parentId === null ? undefined : index.byId.get(parentId)
  const askType = !current && parentId === null
  const root = parent ? rootOf(index, parent) : current?.parentId === null ? current : undefined
  // Aviso NO bloqueante: «Lacteos» junto a «Lácteos» (la BD solo ignora mayúsculas, no tildes; CA-6).
  const similar = errors.name ? undefined : findSimilar(siblingsOf(index, parentId, current?.id), name)

  const handleError = (e: unknown, values: CategoryFormValues) => {
    if (isApiError(e) && e.kind === 'http') {
      const focus = { shouldFocus: true }
      switch (e.code) {
        case 'category.name_conflict':
          // Otro ADMIN la creó a la vez: mismo texto que la comprobación local, y el árbol se pone al día.
          void refreshCategories()
          return setError('name', { type: 'validate', message: nameConflictMessage(values.name.trim(), parentId, ctx) }, focus)
        case 'category.max_depth':
        case 'category.parent_inactive':
          // Solo por carrera (la UI no ofrece padres inválidos): error en «Categoría superior» y árbol al día.
          void refreshCategories()
          return setError('parentId', { type: 'validate', message: msg(`api.${e.code}`) }, focus)
        case 'category.type_required':
          return setError('productType', { type: 'server', message: e.detail ?? '' }, focus)
        case 'resource.version_conflict':
          return setVersionConflict(true)
        case 'validation.failed': {
          const fields = Object.entries(e.errors ?? {}).filter((entry): entry is [Field, string] =>
            (FIELDS as readonly string[]).includes(entry[0]),
          )
          fields.forEach(([f, m], i) => setError(f, { type: 'server', message: m }, { shouldFocus: i === 0 }))
          if (fields.length > 0) return
        }
      }
    }
    setAlert(messageForError(e))
  }

  const onSubmit = (values: CategoryFormValues) => {
    if (busy) return // un doble clic no guarda dos veces
    setAlert(null)
    setVersionConflict(false)
    const done = (result: CategoryResponse) => {
      onSaved(result, !current)
      setSaved(true)
    }
    if (current) {
      rename.mutate(
        { id: current.id, body: toUpdateRequest(values, current.version) },
        { onSuccess: done, onError: (e) => handleError(e, values) },
      )
    } else {
      create.mutate(toCreateRequest(values), { onSuccess: done, onError: (e) => handleError(e, values) })
    }
  }
  const submit = handleSubmit(onSubmit)

  /** Tras un conflicto de versión: trae el nombre actual (lo escrito se pierde, como en productos). */
  const reload = async () => {
    if (!current) return
    try {
      const fresh = await categoriesApi.get(current.id)
      queryClient.setQueryData<CategoryResponse[]>(categoryKeys.list(), (old) => (old ? upsertCategory(old, fresh) : old))
      setCurrent(fresh)
      reset(toFormValues(fresh, fresh.parentId))
      setVersionConflict(false)
      setAlert(null)
    } catch (e) {
      setAlert(messageForError(e))
    }
  }

  const a11y = (field: Field, help: boolean) => ({
    id: `cf-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby':
      [help ? `cf-${field}-help` : '', errors[field] ? `cf-${field}-error` : '', field === 'name' && similar ? 'cf-name-warn' : '']
        .filter(Boolean)
        .join(' ') || undefined,
  })
  const fieldError = (field: Field) => <FieldErrorText id={`cf-${field}-error`} text={errorText(errors[field])} />
  const hint = (required: boolean) => <span className="hint">{t(required ? 'common.required' : 'common.optional')}</span>
  const typeName = root ? t(`product_type.${root.productType}`) : ''

  return (
    <dialog
      ref={ref}
      className="c-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (busy) e.preventDefault() // Escape no cierra mientras se guarda
      }}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className="c-modal__body">
          <h2 id={titleId}>
            {current ? t('categories.form_rename_title', { name: categoryName(current, lang) }) : t('categories.form_new_title')}
          </h2>

          <div className="alerts">
            <ServerWakingNotice />
            {versionConflict && (
              <Alert
                variant="danger"
                title={t('categories.version_conflict_title')}
                action={
                  <button type="button" className="c-btn c-btn--secondary" onClick={() => void reload()}>
                    {t('categories.reload')}
                  </button>
                }
              >
                {t('categories.version_conflict_body')}
              </Alert>
            )}
            {alert && <ErrorAlert message={alert} onRetry={() => void submit()} />}
          </div>

          <div className="fields">
            {!current && (
              <div className="c-field">
                <label className="c-label" htmlFor="cf-parentId">
                  {t('categories.parent')}
                </label>
                <select
                  className="c-select"
                  {...a11y('parentId', true)}
                  {...register('parentId', {
                    // Al cambiar de padre cambian las hermanas: se vuelve a comprobar el nombre si ya hay uno.
                    onChange: () => {
                      if (getValues('name').trim()) void trigger('name')
                    },
                  })}
                >
                  <option value="">{t('categories.parent_none')}</option>
                  {parentOptions(index.all, lang).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {categoryPath(c, lang)}
                    </option>
                  ))}
                </select>
                <p className="c-help" id="cf-parentId-help">
                  {t('categories.parent_help')}
                </p>
                {fieldError('parentId')}
              </div>
            )}

            {askType ? (
              <div className="c-field">
                <label className="c-label" htmlFor="cf-productType">
                  {t('categories.type')} {hint(true)}
                </label>
                <select className="c-select" {...a11y('productType', true)} {...register('productType')}>
                  <option value="">{t('categories.type_placeholder')}</option>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`product_type.${type}`)}
                    </option>
                  ))}
                </select>
                <p className="c-help" id="cf-productType-help">
                  {t('categories.type_help')}
                </p>
                {fieldError('productType')}
              </div>
            ) : (
              root && (
                // El tipo no se elige: se hereda de la raíz (CA-3) o, al renombrar, no se puede cambiar (CA-8).
                <p className="inherited">
                  <Icon name="lock" />
                  <span>
                    {root.id === current?.id
                      ? t('categories.type_tag', { type: typeName })
                      : t('categories.type_inherited', { type: typeName, root: categoryName(root, lang) })}
                  </span>
                </p>
              )
            )}

            <div className="c-field">
              <label className="c-label" htmlFor="cf-name">
                {t('categories.name_es')} {hint(true)}
              </label>
              <input className="c-input" autoComplete="off" maxLength={NAME_MAX} {...a11y('name', false)} {...register('name')} />
              {fieldError('name')}
              {similar && (
                <p className="c-warn" id="cf-name-warn">
                  <Icon name="info" />
                  <span>{t('categories.similar_warning', { name: similar.name })}</span>
                </p>
              )}
            </div>

            <div className="c-field">
              <label className="c-label" htmlFor="cf-nameEn">
                {t('categories.name_en')} {hint(false)}
              </label>
              <input
                className="c-input"
                autoComplete="off"
                lang="en"
                maxLength={NAME_MAX}
                {...a11y('nameEn', true)}
                {...register('nameEn')}
              />
              <p className="c-help" id="cf-nameEn-help">
                {t('categories.name_en_help')}
              </p>
              {fieldError('nameEn')}
            </div>

            {current && <p className="c-help">{t('categories.rename_note')}</p>}
          </div>
        </div>

        <div className="c-modal__actions btn-bar">
          <button type="button" className="c-btn c-btn--secondary" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="c-btn c-btn--primary" disabled={busy} aria-busy={busy || undefined}>
            {busy && <span className="spinner" aria-hidden="true" />}
            <span>{t(busy ? 'common.saving' : current ? 'categories.save_name' : 'categories.create')}</span>
          </button>
        </div>
      </form>
    </dialog>
  )
}
