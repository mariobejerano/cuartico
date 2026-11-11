/**
 * Claves de caché de categorías. Viven en su propio archivo (sin React ni API) para que `products/queries.ts` pueda
 * invalidarlas sin importar `categories/queries.ts`, que a su vez importa las claves de productos (evita un ciclo).
 * Una sola lista (todas, activas e inactivas): la usan el árbol, filtros y formularios.
 */
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => ['categories', 'list'] as const,
}
