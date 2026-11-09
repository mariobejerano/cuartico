import { useTranslation } from 'react-i18next'
import type { ProductResponse } from '../../api/types'
import { SHOW_STOCK_BADGES } from './features'
import { productBadges } from './stockBadge'

/** Etiquetas de estado de un producto: «Inactivo» y, desde HU-04, las de stock. */
export function ProductBadges({ product }: { product: ProductResponse }) {
  const { t } = useTranslation()
  const badges = productBadges(product, SHOW_STOCK_BADGES)
  if (badges.length === 0) return null
  return (
    <div className="badges">
      {badges.map((b) => (
        <span key={b.labelKey} className={`c-badge c-badge--${b.variant}`}>
          {t(b.labelKey)}
        </span>
      ))}
    </div>
  )
}
