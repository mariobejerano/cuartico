import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiError } from '../../api/errors'
import type { CategoryResponse } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { messageForError } from '../../components/errorMessage'
import { useToast } from '../../components/toast'
import { useRefreshCategories, useSetCategoryActive } from './queries'
import { byName, categoryName, categoryPath, shortList, type CategoryIndex } from './tree'

/** Bloqueo explicado ANTES de llamar a la API (notas de UX §4): se guarda qué pasó, el texto se calcula al pintar. */
type Blocked = { kind: 'children' | 'parent'; category: CategoryResponse }

/**
 * Activar / desactivar categorías (CA-9, CA-10), como `useToggleActive` de productos:
 * - Desactivar con hijas activas → diálogo informativo «Primero desactiva sus subcategorías…» (sin llamar a la API).
 * - Desactivar → confirmación (primario, no rojo: es reversible) y aviso con «Deshacer».
 * - Activar con la superior inactiva → diálogo «Primero activa…». Activar normal: directo, con aviso.
 * Las carreras (otro ADMIN cambió el árbol) llegan como 409 y se muestran como aviso de error.
 */
export function useCategoryToggle(index: CategoryIndex): {
  toggle: (category: CategoryResponse) => void
  dialogs: ReactNode
} {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const toast = useToast()
  const mutation = useSetCategoryActive()
  const refreshCategories = useRefreshCategories()
  const [confirming, setConfirming] = useState<CategoryResponse | null>(null)
  const [blocked, setBlocked] = useState<Blocked | null>(null)

  const showError = (e: unknown) => {
    if (isApiError(e) && (e.code === 'category.has_active_children' || e.code === 'category.parent_inactive')) {
      void refreshCategories()
      return toast({ variant: 'danger', text: t(`api.${e.code}`) })
    }
    const m = messageForError(e)
    toast({ variant: 'danger', text: m.text ?? t(m.titleKey ?? m.bodyKey ?? 'net.unexpected_generic') })
  }

  const activate = (c: CategoryResponse, announce: boolean) => {
    const parent = c.parentId === null ? undefined : index.byId.get(c.parentId)
    if (parent && !parent.active) return setBlocked({ kind: 'parent', category: c })
    mutation.mutate(
      { id: c.id, active: true },
      {
        onSuccess: (saved) => {
          if (announce) toast({ text: t('categories.activated', { name: categoryName(saved, lang) }) })
        },
        onError: showError,
      },
    )
  }

  const toggle = (c: CategoryResponse) => {
    if (mutation.isPending) return
    if (!c.active) return activate(c, true)
    if (index.children(c.id).some((k) => k.active)) return setBlocked({ kind: 'children', category: c })
    setConfirming(c)
  }

  const confirmDeactivate = () => {
    if (!confirming) return
    mutation.mutate(
      { id: confirming.id, active: false },
      {
        onSuccess: (saved) => {
          setConfirming(null)
          toast({
            text: t('categories.deactivated', { name: categoryName(saved, lang) }),
            action: { label: t('common.undo'), run: () => activate(saved, false) },
          })
        },
        onError: (e) => {
          setConfirming(null)
          showError(e)
        },
      },
    )
  }

  /** Título y texto del bloqueo, en el idioma actual. */
  const blockedText = (b: Blocked) => {
    const name = categoryName(b.category, lang)
    if (b.kind === 'children') {
      const names = index
        .children(b.category.id)
        .filter((k) => k.active)
        .sort(byName(lang))
        .map((k) => t('categories.quoted', { name: categoryName(k, lang) }))
      const list = shortList(names, 4, (first, count) => t('categories.and_more', { list: first, count }))
      return {
        title: t('categories.blocked_children_title', { name }),
        body: t('categories.blocked_children_body', { list }),
      }
    }
    const parent = b.category.parentId === null ? undefined : index.byId.get(b.category.parentId)
    return {
      title: t('categories.blocked_parent_title', { parent: parent ? categoryPath(parent, lang) : '' }),
      body: t('categories.blocked_parent_body'),
    }
  }
  const info = blocked ? blockedText(blocked) : null

  const c = confirming
  const dialogs = (
    <>
      <ConfirmDialog
        open={!!c}
        title={c ? t('categories.deactivate_title', { name: categoryName(c, lang) }) : ''}
        cancelLabel={t('common.cancel')}
        confirmLabel={<span>{t(mutation.isPending ? 'categories.deactivating' : 'categories.deactivate')}</span>}
        busy={mutation.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDeactivate}
      >
        {/* Supervisión, 2026-11-10: cuántos productos la conservan, solo si hay alguno (plural de i18next: _one/_other) */}
        {c && c.productCount > 0 && <p>{t('categories.deactivate_products', { count: c.productCount })}</p>}
        <p>{t('categories.deactivate_body')}</p>
      </ConfirmDialog>
      {/* Diálogo informativo: un solo botón, sin acción que confirmar */}
      <ConfirmDialog
        open={!!info}
        title={info?.title ?? ''}
        confirmLabel={t('common.got_it')}
        onCancel={() => setBlocked(null)}
        onConfirm={() => setBlocked(null)}
      >
        <p>{info?.body}</p>
      </ConfirmDialog>
    </>
  )

  return { toggle, dialogs }
}
