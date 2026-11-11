import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { productsApi } from '../../api/products'
import type { CreateProductRequest, ProductListParams, ProductResponse, UpdateProductRequest } from '../../api/types'
import { categoryKeys } from '../categories/keys'

/**
 * Claves de la caché de TanStack Query. Son jerárquicas, como rutas: invalidar `['products']` marca como
 * obsoleto TODO lo de productos (listados y detalle) de una vez. Las categorías tienen sus propias claves (`categoryKeys`).
 * Analogía: los nombres de caché de `@Cacheable("products")` + `@CacheEvict(allEntries = true)`.
 */
export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => ['products', 'list', params] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
}

/** Una página del listado. Cada combinación de filtros es una entrada distinta de la caché. */
export function useProductList(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: ({ signal }) => productsApi.list(params, signal),
  })
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? -1),
    queryFn: ({ signal }) => productsApi.get(id!, signal),
    enabled: id !== null, // sin id válido (p. ej. /products/abc/edit) no se llama a la API
  })
}

/**
 * El árbol de categorías muestra cuántos productos tiene cada una (`productCount`). Si un guardado puede cambiar ese
 * número, invalidamos también las categorías para no enseñar un dato viejo durante los 5 min de caché.
 */
function invalidateCategoryCounts(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}

/**
 * Guardar (alta o edición). Una MUTACIÓN cambia datos en el servidor; al terminar bien, invalidamos la caché
 * de productos para que el listado se vuelva a pedir con el cambio.
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: number | null; body: CreateProductRequest; version?: number }) =>
      input.id === null
        ? productsApi.create(input.body)
        : productsApi.update(input.id, { ...input.body, version: input.version ?? 0 } satisfies UpdateProductRequest),
    onSuccess: (saved, input) => {
      // Alta → siempre cambia un contador; edición → solo si cambió la categoría (comparamos con la versión en caché).
      const before = input.id === null ? undefined : queryClient.getQueryData<ProductResponse>(productKeys.detail(input.id))
      const categoryChanged = input.id === null || before?.category.id !== saved.category.id
      queryClient.setQueryData(productKeys.detail(saved.id), saved)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        categoryChanged ? invalidateCategoryCounts(queryClient) : undefined,
      ])
    },
  })
}

/** Activar / desactivar (solo ADMIN, CA-13/CA-24). Devuelve el producto actualizado. */
export function useSetProductActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }): Promise<ProductResponse> =>
      active ? productsApi.activate(id) : productsApi.deactivate(id),
    onSuccess: (saved) => {
      queryClient.setQueryData(productKeys.detail(saved.id), saved)
      // Solo listados: el detalle ya está al día y así no se repinta el formulario abierto.
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: productKeys.all,
          predicate: (q) => q.queryKey[1] !== 'detail',
        }),
        invalidateCategoryCounts(queryClient), // por si el contador cuenta solo activos
      ])
    },
  })
}
