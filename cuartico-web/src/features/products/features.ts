/**
 * Interruptores de funcionalidades de productos, en un único sitio.
 *
 * Etiquetas de stock («Sin stock», «Stock bajo») ocultas hasta HU-04 (decisión de la supervisión, 2026-11-05):
 * en el Sprint 1 todo el stock es 0 y todas las filas dirían «Sin stock». La lógica (`stockBadge`) y los textos ya
 * existen; HU-04 pone esto a `true` (o elimina la constante) en el mismo PR. Ver docs/design/ux-notes/products.md §5.
 */
export const SHOW_STOCK_BADGES = false
