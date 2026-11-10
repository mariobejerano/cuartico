import type { CategoryRef, CategoryResponse, ProductType } from '../../api/types'

/**
 * Lógica pura del árbol de categorías (HU-15). Sin React ni DOM: se prueba con tests unitarios simples y se podrá
 * reutilizar tal cual en React Native. Analogía: un `CategoryTreeHelper` estático de Java.
 *
 * La API devuelve una lista PLANA (cada categoría con su `parentId`); aquí la indexamos para recorrerla como árbol.
 */

/** Máximo de niveles (CA-4): una categoría de nivel 3 no admite hijas. */
export const MAX_DEPTH = 3

const isEnglish = (lang: string) => lang.startsWith('en')

/** Nombre visible según el idioma de la interfaz: en inglés `nameEn ?? name` (CA-28). */
export const categoryName = (c: Pick<CategoryResponse, 'name' | 'nameEn'>, lang: string) =>
  isEnglish(lang) ? (c.nameEn ?? c.name) : c.name

/** Ruta visible («Alimentos › Granos») según el idioma. La calcula el backend en los dos idiomas. */
export const categoryPath = (c: Pick<CategoryRef, 'path' | 'pathEn'>, lang: string) => (isEnglish(lang) ? c.pathEn : c.path)

/** Misma normalización que la BD (`LOWER(TRIM(name))`, CA-6): «  LÁCTEOS » y «lácteos» son el mismo nombre. */
export const nameKey = (s: string) => s.trim().toLowerCase()

/**
 * Además quita las tildes: SOLO para el aviso de parecido («Lacteos» ~ «Lácteos»), que no bloquea (CA-6).
 * `normalize('NFD')` separa «á» en «a» + tilde combinable, y `\p{M}` (marcas Unicode) borra la tilde.
 */
export const looseKey = (s: string) => nameKey(s).normalize('NFD').replace(/\p{M}/gu, '')

/** Comparador por nombre visible, sin distinguir mayúsculas ni tildes al ordenar («Ácido» junto a «Aceite»). */
export const byName = (lang: string) => (a: CategoryResponse, b: CategoryResponse) =>
  categoryName(a, lang).localeCompare(categoryName(b, lang), lang, { sensitivity: 'base' })

export const byPath = (lang: string) => (a: CategoryRef, b: CategoryRef) =>
  categoryPath(a, lang).localeCompare(categoryPath(b, lang), lang, { sensitivity: 'base' })

/** Índice para recorrer el árbol: por id y por padre (`null` = raíces). Se construye una vez por lista. */
export interface CategoryIndex {
  all: CategoryResponse[]
  byId: Map<number, CategoryResponse>
  children: (parentId: number | null) => CategoryResponse[]
}

export function indexCategories(list: CategoryResponse[]): CategoryIndex {
  const byId = new Map(list.map((c) => [c.id, c]))
  const byParent = new Map<number | null, CategoryResponse[]>()
  for (const c of list) {
    const siblings = byParent.get(c.parentId) ?? []
    siblings.push(c)
    byParent.set(c.parentId, siblings)
  }
  return { all: list, byId, children: (parentId) => byParent.get(parentId) ?? [] }
}

/** La raíz de una categoría (de ella sale el tipo). */
export function rootOf(index: CategoryIndex, c: CategoryResponse): CategoryResponse {
  let node = c
  while (node.parentId !== null) {
    const parent = index.byId.get(node.parentId)
    if (!parent) break // lista incompleta: no debería pasar, pero nunca un bucle infinito
    node = parent
  }
  return node
}

/** Hermanas de un futuro nombre: las hijas de `parentId` (activas E inactivas, CA-6), menos la que se renombra. */
export const siblingsOf = (index: CategoryIndex, parentId: number | null, excludeId?: number) =>
  index.children(parentId).filter((c) => c.id !== excludeId)

/** Hermana con el mismo nombre normalizado: el servidor respondería 409 `category.name_conflict`. */
export const findNameConflict = (siblings: CategoryResponse[], name: string) =>
  name.trim() ? siblings.find((s) => nameKey(s.name) === nameKey(name)) : undefined

/** Hermana que solo se diferencia en tildes: aviso ámbar, no error (CA-6). */
export const findSimilar = (siblings: CategoryResponse[], name: string) =>
  name.trim() ? siblings.find((s) => looseKey(s.name) === looseKey(name) && nameKey(s.name) !== nameKey(name)) : undefined

/** ¿Admite subcategorías? Activa y por debajo del nivel 3 (CA-4, CA-5, CA-25). */
export const canHaveChildren = (c: CategoryResponse) => c.active && c.depth < MAX_DEPTH

/** Padres válidos en el diálogo «Nueva categoría»: activas de nivel 1 y 2, ordenadas por ruta. */
export const parentOptions = (list: CategoryResponse[], lang: string) =>
  list.filter(canHaveChildren).sort(byPath(lang))

export type CategoryAction = 'add' | 'rename' | 'deactivate' | 'activate'

/** Clave del texto de cada acción (la comparten las filas de escritorio y la hoja de acciones del móvil). */
export const ACTION_LABEL: Record<CategoryAction, string> = {
  add: 'categories.add_sub',
  rename: 'categories.rename',
  deactivate: 'categories.deactivate',
  activate: 'categories.activate',
}

/** Acciones de una fila, en el orden del prototipo. «Añadir subcategoría» se oculta en nivel 3 e inactivas (CA-25). */
export function nodeActions(c: CategoryResponse): CategoryAction[] {
  const actions: CategoryAction[] = []
  if (canHaveChildren(c)) actions.push('add')
  actions.push('rename', c.active ? 'deactivate' : 'activate')
  return actions
}

/**
 * Opciones del filtro «Categoría» del listado (CA-27): TODAS (también las inactivas, para encontrar lo que hay que
 * reclasificar) y, si hay un tipo elegido, solo las de ese tipo. Ordenadas por ruta.
 */
export const filterOptions = (list: CategoryResponse[], type: ProductType | '', lang: string) =>
  list.filter((c) => !type || c.productType === type).sort(byPath(lang))

/** Opciones del formulario de producto (CA-26): las activas y, si el producto está en una inactiva, también esa. */
export const productFormOptions = (list: CategoryResponse[], currentId: number | null, lang: string) =>
  list.filter((c) => c.active || c.id === currentId).sort(byPath(lang))

/** Inserta o reemplaza una categoría en la lista (para poner la caché al día con la respuesta de la API). */
export function upsertCategory(list: CategoryResponse[], saved: CategoryResponse): CategoryResponse[] {
  return list.some((c) => c.id === saved.id) ? list.map((c) => (c.id === saved.id ? saved : c)) : [...list, saved]
}

/** «A, B, C, D y 3 más» (máximo 4 nombres): para el aviso de «tiene subcategorías activas». */
export function shortList(names: string[], max: number, andMore: (list: string, count: number) => string): string {
  if (names.length <= max) return names.join(', ')
  return andMore(names.slice(0, max).join(', '), names.length - max)
}
