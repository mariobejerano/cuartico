import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryResponse } from '../../api/types'
import { Icon, type IconName } from '../../components/Icon'
import { ACTION_LABEL, categoryName, categoryPath, MAX_DEPTH, nodeActions, type CategoryAction } from './tree'

const ACTION_ICON: Record<CategoryAction, IconName> = { add: 'plus', rename: 'edit', deactivate: 'power', activate: 'power' }

interface ActionsSheetProps {
  category: CategoryResponse
  lang: string
  onAction: (action: CategoryAction, category: CategoryResponse) => void
  onClose: () => void
}

/**
 * Hoja de acciones de una categoría (móvil, notas de UX §2): en 360 px no caben tres botones por fila con la sangría
 * de 3 niveles, así que la fila lleva un «⋯» y las acciones salen aquí, grandes y con su explicación.
 * Reutiliza el aspecto de la hoja de cuenta (`c-modal` es una hoja inferior en móvil).
 */
export function ActionsSheet({ category: c, lang, onAction, onClose }: ActionsSheetProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  /** Acción elegida: se ejecuta DESPUÉS de cerrar la hoja, para que el siguiente diálogo no se abra encima. */
  const chosen = useRef<CategoryAction | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const choose = (action: CategoryAction) => {
    chosen.current = action
    ref.current?.close()
  }
  const handleClose = () => {
    onClose()
    if (chosen.current) onAction(chosen.current, c)
  }

  return (
    <dialog ref={ref} className="c-modal" aria-labelledby={titleId} onClose={handleClose}>
      <div className="c-modal__body">
        <div>
          <h2 id={titleId}>{categoryName(c, lang)}</h2>
          <p className="small muted">
            {c.parentId === null
              ? t('categories.type_tag', { type: t(`product_type.${c.productType}`) })
              : categoryPath(c, lang)}
          </p>
        </div>
        <ul className="sheet-list">
          {nodeActions(c).map((action) => (
            <li key={action}>
              <button type="button" onClick={() => choose(action)}>
                <Icon name={ACTION_ICON[action]} />
                <span>{t(ACTION_LABEL[action])}</span>
              </button>
            </li>
          ))}
          {/* En escritorio la ausencia de «Añadir subcategoría» se entiende por la sangría; aquí hay sitio para decirlo */}
          {c.active && c.depth >= MAX_DEPTH && <li className="sheet-note">{t('categories.max_level_note')}</li>}
          {!c.active && c.depth < MAX_DEPTH && <li className="sheet-note">{t('categories.inactive_note')}</li>}
        </ul>
      </div>
      <div className="c-modal__actions">
        <button type="button" className="c-btn c-btn--secondary c-btn--block" onClick={() => ref.current?.close()}>
          {t('common.close')}
        </button>
      </div>
    </dialog>
  )
}
