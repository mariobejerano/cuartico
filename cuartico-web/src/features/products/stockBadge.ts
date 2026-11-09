import type { ProductResponse } from '../../api/types'

export interface Badge {
  /** Clave de traducción del texto. */
  labelKey: string
  variant: 'neutral' | 'warning' | 'danger'
}

/**
 * Etiqueta de stock de un producto (ux-notes/products.md §5). Completa desde ya, aunque hasta HU-04 no se pinta
 * (`SHOW_STOCK_BADGES`): un inactivo no lleva etiqueta de stock; disponible ≤ 0 → «Sin stock»; `lowStock` → «Stock bajo».
 * «Sin stock» lo deriva el frontend; `lowStock` llega calculado de la API.
 */
export function stockBadge(product: Pick<ProductResponse, 'active' | 'stock' | 'lowStock'>): Badge | null {
  if (!product.active) return null
  if (product.stock.available <= 0) return { labelKey: 'products.badge_out_of_stock', variant: 'danger' }
  if (product.lowStock) return { labelKey: 'products.badge_low_stock', variant: 'warning' }
  return null
}

/** Etiquetas de una fila: «Inactivo» siempre; las de stock solo si el interruptor está encendido. */
export function productBadges(
  product: Pick<ProductResponse, 'active' | 'stock' | 'lowStock'>,
  showStockBadges: boolean,
): Badge[] {
  if (!product.active) return [{ labelKey: 'products.badge_inactive', variant: 'neutral' }]
  const stock = showStockBadges ? stockBadge(product) : null
  return stock ? [stock] : []
}
