import { useTranslation } from 'react-i18next'
import type { CategoryResponse } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ACTION_LABEL, byName, categoryName, nodeActions, type CategoryAction, type CategoryIndex } from './tree'

export interface CategoryNodeProps {
  category: CategoryResponse
  index: CategoryIndex
  lang: string
  showInactive: boolean
  /** Escritorio: botones de texto en la fila. Móvil: un botón «⋯» que abre la hoja de acciones. */
  desktop: boolean
  /** Fila recién creada: se ilumina un instante. */
  highlightId: number | null
  onAction: (action: CategoryAction, category: CategoryResponse) => void
  onOpenSheet: (category: CategoryResponse) => void
}

/**
 * Una categoría y, debajo, sus hijas. COMPONENTE RECURSIVO: para pintar las hijas se usa a sí mismo
 * (`<CategoryNode>` dentro de `<CategoryNode>`), igual que un método recursivo en Java recorre un árbol.
 * La recursión termina sola: una categoría sin hijas visibles no pinta la lista anidada (máximo 3 niveles, CA-4).
 *
 * Marcado: lista anidada `<ul>/<li>` con encabezados (`h2` la raíz, `h3` el resto), NO `role="tree"`
 * (notas de UX §2): el árbol es corto y siempre está desplegado, y el lector ya anuncia «lista, nivel 2».
 */
export function CategoryNode(props: CategoryNodeProps) {
  const { category: c, index, lang, showInactive, desktop, highlightId, onAction, onOpenSheet } = props
  const { t } = useTranslation()
  const isRoot = c.parentId === null
  const Heading = isRoot ? 'h2' : 'h3'
  const name = categoryName(c, lang)
  const english = lang.startsWith('en')
  const children = index
    .children(c.id)
    .filter((k) => showInactive || k.active)
    .sort(byName(lang))

  return (
    <>
      <div className={`node-row${c.id === highlightId ? ' is-new' : ''}`}>
        <div className="node-main">
          <Heading className="node-name" id={`cn-${c.id}`}>
            <span className="nm">{name}</span>
            {isRoot && <span className="c-tag">{t('categories.type_tag', { type: t(`product_type.${c.productType}`) })}</span>}
            {!c.active && <span className="c-badge c-badge--neutral">{t('categories.badge_inactive')}</span>}
          </Heading>
          {/* Segunda línea: el nombre en el OTRO idioma, o el aviso de que falta el inglés (notas de UX §2) */}
          {c.nameEn ? (
            <p className="node-sub" lang={english ? 'es' : 'en'}>
              {t('categories.other_lang_name', { name: english ? c.name : c.nameEn })}
            </p>
          ) : (
            <p className="node-sub is-missing">{t('categories.missing_other_lang')}</p>
          )}
        </div>
        {desktop ? (
          <div className="node-actions">
            {nodeActions(c).map((action) => (
              <button key={action} type="button" className="c-btn c-btn--ghost c-btn--sm" onClick={() => onAction(action, c)}>
                {/* El nombre oculto completa el botón para el lector: «Renombrar Granos» */}
                {t(ACTION_LABEL[action])} <span className="sr-only">{name}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="c-btn c-btn--secondary c-btn--icon"
            aria-haspopup="dialog"
            aria-label={t('categories.actions_for', { name })}
            onClick={() => onOpenSheet(c)}
          >
            <Icon name="dots" />
          </button>
        )}
      </div>
      {children.length > 0 && (
        <ul className="tree">
          {children.map((child) => (
            <li key={child.id} className={`node${child.active ? '' : ' is-inactive'}`}>
              <CategoryNode {...props} category={child} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
