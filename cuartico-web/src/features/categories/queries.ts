import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { categoriesApi } from '../../api/categories'
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from '../../api/types'
import { productKeys } from '../products/queries'
import { categoryKeys } from './keys'
import { upsertCategory } from './tree'

export { categoryKeys }

/**
 * Todas las categorías (lista plana). La comparten la página de categorías, el filtro del listado de productos y el
 * selector del formulario: TanStack Query hace UNA petición y las tres pantallas leen la misma caché.
 * Cambian poco: 5 min sin volver a pedirlas.
 */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: ({ signal }) => categoriesApi.list(signal),
    staleTime: 5 * 60_000,
  })
}

/**
 * Tras guardar: la lista se pone al día al momento con la respuesta (la fila nueva aparece sin esperar) y después se
 * vuelve a pedir, porque un renombrado cambia también las rutas de las hijas. Los productos muestran la ruta de su
 * categoría, así que su caché también queda obsoleta.
 */
function afterSave(queryClient: QueryClient, saved: CategoryResponse) {
  queryClient.setQueryData<CategoryResponse[]>(categoryKeys.list(), (old) => (old ? upsertCategory(old, saved) : old))
  void queryClient.invalidateQueries({ queryKey: productKeys.all })
  return queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCategoryRequest) => categoriesApi.create(body),
    onSuccess: (saved) => afterSave(queryClient, saved),
  })
}

export function useRenameCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateCategoryRequest }) => categoriesApi.update(id, body),
    onSuccess: (saved) => afterSave(queryClient, saved),
  })
}

export function useSetCategoryActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? categoriesApi.activate(id) : categoriesApi.deactivate(id),
    onSuccess: (saved) => afterSave(queryClient, saved),
  })
}

/** Para cuando el servidor dice que el árbol cambió (carreras: otro ADMIN desactivó un padre…). */
export function useRefreshCategories() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}
