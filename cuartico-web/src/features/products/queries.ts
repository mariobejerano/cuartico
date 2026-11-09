import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '../../api/products'
import type { CreateProductRequest, ProductListParams, ProductResponse, UpdateProductRequest } from '../../api/types'

/**
 * Claves de la caché de TanStack Query. Son jerárquicas, como rutas: invalidar `['products']` marca como
 * obsoleto TODO lo de productos (listados, detalle y categorías) de una vez.
 * Analogía: los nombres de caché de `@Cacheable("products")` + `@CacheEvict(allEntries = true)`.
 */
export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => ['products', 'list', params] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
  categories: () => ['products', 'categories'] as const,
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

/** Categorías existentes para el filtro y el autocompletado (CA-22). Cambian poco: 5 min en caché. */
export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: ({ signal }) => productsApi.categories(signal),
    staleTime: 5 * 60_000,
  })
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
    onSuccess: (saved) => {
      queryClient.setQueryData(productKeys.detail(saved.id), saved)
      return queryClient.invalidateQueries({ queryKey: productKeys.all })
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
      // Solo listados y categorías: el detalle ya está al día y así no se repinta el formulario abierto.
      return queryClient.invalidateQueries({
        queryKey: productKeys.all,
        predicate: (q) => q.queryKey[1] !== 'detail',
      })
    },
  })
}
