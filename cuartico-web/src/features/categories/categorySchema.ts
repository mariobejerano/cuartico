import { z } from 'zod'
import {
  PRODUCT_TYPES,
  type CategoryResponse,
  type CreateCategoryRequest,
  type ProductType,
  type UpdateCategoryRequest,
} from '../../api/types'
import { msg } from '../../components/fieldMessage'
import { categoryPath, findNameConflict, siblingsOf, type CategoryIndex } from './tree'

export const NAME_MAX = 60

/** Lo que el diálogo sabe del árbol para validar sin preguntar al servidor. */
export interface CategoryFormContext {
  index: CategoryIndex
  lang: string
  /** En «Renombrar», la categoría que se edita (su padre no cambia, CA-8). `null` = alta. */
  editing: CategoryResponse | null
}

/** Valores del diálogo. Todo texto, como en los `<input>`/`<select>`: `parentId` '' = categoría principal. */
export interface CategoryFormValues {
  parentId: string
  productType: ProductType | ''
  name: string
  nameEn: string
}

export const toParentId = (raw: string): number | null => (raw ? Number(raw) : null)

/** Padre efectivo: el elegido en un alta, el de siempre al renombrar. */
export const effectiveParentId = (values: Pick<CategoryFormValues, 'parentId'>, ctx: Pick<CategoryFormContext, 'editing'>) =>
  ctx.editing ? ctx.editing.parentId : toParentId(values.parentId)

/**
 * Mensaje del duplicado (CA-6), igual para la comprobación local y para el 409 del servidor:
 * «Ya existe «Granos» dentro de «Alimentos».» o, entre raíces, «Ya existe una categoría principal llamada «Ropa».»
 */
export function nameConflictMessage(name: string, parentId: number | null, ctx: CategoryFormContext): string {
  const parent = parentId === null ? undefined : ctx.index.byId.get(parentId)
  return parent
    ? msg('api.category.name_conflict', { name, parent: categoryPath(parent, ctx.lang) })
    : msg('api.category.name_conflict_root', { name })
}

/**
 * Esquema del diálogo «Nueva categoría» / «Renombrar». FÁBRICA, como el de productos: el duplicado y el tipo
 * obligatorio dependen del árbol y de otro campo (el padre elegido).
 *
 * El duplicado se comprueba AQUÍ, sin esperar al servidor (el árbol ya está cargado, CA-6): el error sale al salir del
 * campo. La garantía final sigue siendo la restricción única de la BD (409 si dos personas crean lo mismo a la vez).
 */
export function buildCategorySchema(ctx: CategoryFormContext) {
  return z
    .object({
      parentId: z.string(),
      productType: z.union([z.enum(PRODUCT_TYPES), z.literal('')]),
      name: z
        .string()
        .trim()
        .min(1, msg('validation.required'))
        .max(NAME_MAX, msg('validation.max_length', { max: NAME_MAX })),
      nameEn: z
        .string()
        .trim()
        .max(NAME_MAX, msg('validation.max_length', { max: NAME_MAX })),
    })
    .superRefine((values, issues) => {
      const parentId = effectiveParentId(values, ctx)
      // Una raíz nueva necesita tipo (CA-2); una hija lo hereda y no lo lleva (CA-3).
      if (!ctx.editing && parentId === null && values.productType === '') {
        issues.addIssue({ code: 'custom', path: ['productType'], message: msg('validation.required') })
      }
      const conflict = findNameConflict(siblingsOf(ctx.index, parentId, ctx.editing?.id), values.name)
      if (conflict) {
        issues.addIssue({ code: 'custom', path: ['name'], message: nameConflictMessage(values.name.trim(), parentId, ctx) })
      }
    })
}

export function toFormValues(editing: CategoryResponse | null, parentId: number | null): CategoryFormValues {
  return {
    parentId: parentId === null ? '' : String(parentId),
    productType: '',
    name: editing?.name ?? '',
    nameEn: editing?.nameEn ?? '',
  }
}

/** Alta: recorta como el backend (CA-7); `nameEn` vacío → `null`; `productType` SOLO en una raíz (CA-3). */
export function toCreateRequest(values: CategoryFormValues): CreateCategoryRequest {
  const parentId = toParentId(values.parentId)
  const body: CreateCategoryRequest = { name: values.name.trim(), nameEn: values.nameEn.trim() || null, parentId }
  if (parentId === null) body.productType = values.productType as ProductType
  return body
}

export function toUpdateRequest(values: CategoryFormValues, version: number): UpdateCategoryRequest {
  return { name: values.name.trim(), nameEn: values.nameEn.trim() || null, version }
}
