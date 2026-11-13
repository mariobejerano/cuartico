import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { productsApi } from '../../api/products'
import type { CreateProductRequest, UpdateProductRequest } from '../../api/types'
import { CATEGORIES, product, ref } from '../../test/productFixtures'
import { categoryKeys } from '../categories/keys'
import { productKeys, useSaveProduct, useSetProductActive } from './queries'

/** Monta los hooks con una caché que ya tiene las categorías (como si el árbol se hubiera abierto antes). */
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(categoryKeys.list(), CATEGORIES)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const stale = () => queryClient.getQueryState(categoryKeys.list())?.isInvalidated
  return { queryClient, wrapper, stale }
}

const body = { name: 'Arroz blanco', categoryId: 5 } as CreateProductRequest
const update = { name: 'Arroz blanco', categoryId: 5, version: 0 } as UpdateProductRequest

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Contador de productos del árbol (productCount) tras guardar un producto', () => {
  it('alta: invalida las categorías', async () => {
    vi.spyOn(productsApi, 'create').mockResolvedValue(product({ id: 3 }))
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useSaveProduct(), { wrapper })
    await act(() => result.current.mutateAsync({ id: null, body }))
    expect(stale()).toBe(true)
  })

  it('edición sin cambiar de categoría: NO las invalida', async () => {
    vi.spyOn(productsApi, 'update').mockResolvedValue(product({ name: 'Arroz', version: 1 }))
    const { queryClient, wrapper, stale } = setup()
    queryClient.setQueryData(productKeys.detail(1), product())
    const { result } = renderHook(() => useSaveProduct(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 1, body: update }))
    expect(stale()).toBe(false)
  })

  it('edición cambiando de categoría: las invalida', async () => {
    vi.spyOn(productsApi, 'update').mockResolvedValue(product({ category: ref(6), version: 1 }))
    const { queryClient, wrapper, stale } = setup()
    queryClient.setQueryData(productKeys.detail(1), product())
    const { result } = renderHook(() => useSaveProduct(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 1, body: { ...update, categoryId: 6 } }))
    expect(stale()).toBe(true)
  })

  it('activar o desactivar: las invalida', async () => {
    vi.spyOn(productsApi, 'deactivate').mockResolvedValue(product({ active: false, version: 1 }))
    const { wrapper, stale } = setup()
    const { result } = renderHook(() => useSetProductActive(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 1, active: false }))
    expect(stale()).toBe(true)
  })
})
