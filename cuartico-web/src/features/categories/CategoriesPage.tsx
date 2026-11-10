import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryResponse } from '../../api/types'
import { Icon } from '../../components/Icon'
import { LoadError } from '../../components/LoadError'
import { useToast } from '../../components/toast'
import { DESKTOP_QUERY, useMediaQuery } from '../../components/useMediaQuery'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { ActionsSheet } from './ActionsSheet'
import { CategoryDialog } from './CategoryDialog'
import { CategoryNode } from './CategoryNode'
import { useCategories } from './queries'
import { byName, categoryName, indexCategories, type CategoryAction } from './tree'
import { useCategoryToggle } from './useCategoryToggle'

/** Qué diálogo de formulario está abierto: alta (con padre preseleccionado o no) o renombrar. */
type FormState = { editing: CategoryResponse | null; parentId: number | null }

const HIGHLIGHT_MS = 1_600

/**
 * Página «Categorías» (HU-15 CA-25, solo ADMIN: la ruta la protege `RequireRole`). Árbol siempre desplegado con una
 * tarjeta por categoría principal; inactivas ocultas salvo «Mostrar inactivas».
 */
export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  useDocumentTitle('categories.page_title')
  const toast = useToast()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const categories = useCategories()
  // La API da una lista plana; el índice permite pedir «las hijas de X» sin recorrer la lista cada vez.
  const index = useMemo(() => indexCategories(categories.data ?? []), [categories.data])

  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [sheetId, setSheetId] = useState<number | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const { toggle, dialogs } = useCategoryToggle(index)
  const checkId = useId()

  // La fila recién creada se ilumina un instante y luego vuelve a la normalidad.
  useEffect(() => {
    if (highlightId === null) return
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightId])

  const runAction = (action: CategoryAction, c: CategoryResponse) => {
    if (action === 'add') setForm({ editing: null, parentId: c.id })
    else if (action === 'rename') setForm({ editing: c, parentId: c.parentId })
    else toggle(c)
  }

  const onSaved = (saved: CategoryResponse, created: boolean) => {
    if (created) {
      setHighlightId(saved.id)
      toast({ text: t('categories.created', { name: categoryName(saved, lang) }) })
    } else toast({ text: t('categories.renamed') })
  }

  const openNew = () => setForm({ editing: null, parentId: null })
  const inactiveCount = index.all.filter((c) => !c.active).length
  const roots = index
    .children(null)
    .filter((c) => showInactive || c.active)
    .sort(byName(lang))
  const sheetCategory = sheetId === null ? undefined : index.byId.get(sheetId)

  return (
    <>
      <div className="page-head">
        <h1 className="mobile-sr">{t('categories.title')}</h1>
        {isDesktop && (
          <button type="button" className="c-btn c-btn--primary" onClick={openNew}>
            <Icon name="plus" />
            <span>{t('categories.new')}</span>
          </button>
        )}
      </div>
      <p className="intro">{t('categories.intro')}</p>

      {categories.data && (
        <div className="tree-tools">
          <label className="c-check" htmlFor={checkId}>
            <input id={checkId} type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            <span>{t('categories.show_inactive', { count: inactiveCount })}</span>
          </label>
        </div>
      )}

      <div aria-busy={categories.isPending} className="list-region">
        {categories.isPending ? (
          <>
            <div className="skeleton" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="sk-card">
                  <div className="sk sk--40" />
                  <div className="sk sk--65" />
                  <div className="sk sk--85" />
                </div>
              ))}
            </div>
            <p className="sr-only">{t('common.loading')}</p>
          </>
        ) : categories.isError && !categories.data ? (
          <LoadError error={categories.error} titleKey="categories.load_error_title" onRetry={() => void categories.refetch()} />
        ) : (
          <ul className="tree-roots" aria-label={t('categories.title')}>
            {roots.map((root) => (
              <li key={root.id} className={`root-card node${root.active ? '' : ' is-inactive'}`}>
                <CategoryNode
                  category={root}
                  index={index}
                  lang={lang}
                  showInactive={showInactive}
                  desktop={isDesktop}
                  highlightId={highlightId}
                  onAction={runAction}
                  onOpenSheet={(c) => setSheetId(c.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isDesktop && (
        <button type="button" className="c-btn c-btn--primary fab" onClick={openNew}>
          <Icon name="plus" />
          <span>{t('categories.new')}</span>
        </button>
      )}

      {sheetCategory && (
        <ActionsSheet category={sheetCategory} lang={lang} onAction={runAction} onClose={() => setSheetId(null)} />
      )}
      {form && (
        <CategoryDialog
          index={index}
          editing={form.editing}
          initialParentId={form.parentId}
          onSaved={onSaved}
          onClose={() => setForm(null)}
        />
      )}
      {dialogs}
    </>
  )
}
