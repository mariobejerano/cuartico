import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { productsApi } from '../../api/products'
import type {
  CreateProductRequest,
  EnableVariantsRequest,
  ProductListParams,
  ProductResponse,
  UpdateProductRequest,
  UpdateVariantRequest,
  VariantRequest,
} from '../../api/types'
import { categoryKeys } from '../categories/keys'

export type SaveProductInput = { id: null; body: CreateProductRequest } | { id: number; body: UpdateProductRequest }

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
    // Alta (`id: null`, cuerpo de alta) o edición (con id y cuerpo del PUT, que lleva la versión y no las variantes).
    mutationFn: (input: SaveProductInput) =>
      input.id === null ? productsApi.create(input.body) : productsApi.update(input.id, input.body),
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

// ===== Variantes (HU-16) =====

/**
 * Todas las operaciones de variantes devuelven el producto completo. Al terminar bien: guardamos esa respuesta como
 * detalle en la caché e invalidamos solo los LISTADOS (cambian «N variantes» y el disponible agregado). El detalle no se
 * invalida para no repintar el formulario abierto; las categorías tampoco (el producto no cambia de categoría).
 *
 * Es una FÁBRICA de hooks: cada operación solo dice qué endpoint llama. Analogía: una plantilla (`JdbcTemplate`) a la
 * que se le pasa solo lo que cambia.
 */
function useProductCommand<TInput>(call: (input: TInput) => Promise<ProductResponse>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: (saved) => {
      queryClient.setQueryData(productKeys.detail(saved.id), saved)
      return queryClient.invalidateQueries({ queryKey: productKeys.all, predicate: (q) => q.queryKey[1] !== 'detail' })
    },
  })
}

/** CA-8: añadir variantes (todo o nada). */
export const useAddVariants = () =>
  useProductCommand(({ id, variants }: { id: number; variants: VariantRequest[] }) =>
    productsApi.addVariants(id, { variants }),
  )

/** CA-9: editar una variante con su `version`. */
export const useUpdateVariant = () =>
  useProductCommand(({ id, variantId, body }: { id: number; variantId: number; body: UpdateVariantRequest }) =>
    productsApi.updateVariant(id, variantId, body),
  )

/** CA-10 (solo ADMIN): activar / desactivar una variante. */
export const useSetVariantActive = () =>
  useProductCommand(({ id, variantId, active }: { id: number; variantId: number; active: boolean }) =>
    active ? productsApi.activateVariant(id, variantId) : productsApi.deactivateVariant(id, variantId),
  )

/** CA-12 / CA-13: convertir simple ↔ con variantes (estas SÍ suben la versión del producto). */
export const useConvertVariants = () =>
  useProductCommand((input: { id: number; enable: EnableVariantsRequest } | { id: number; enable: null }) =>
    input.enable ? productsApi.enableVariants(input.id, input.enable) : productsApi.disableVariants(input.id),
  )
