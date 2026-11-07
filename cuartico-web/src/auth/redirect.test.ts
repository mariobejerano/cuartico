import { describe, expect, it } from 'vitest'
import { loginPathFor, safeRedirect } from './redirect'

describe('safeRedirect (HU-01 CA-6)', () => {
  it.each([
    ['/products?q=arroz', '/products?q=arroz'],
    ['/', '/'],
    ['/products#top', '/products#top'],
  ])('acepta la ruta interna %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '/products\\..\\x',
    '/\t/evil.com',
    '/login',
    '/login?redirect=/products',
    'products',
    '',
    null,
    undefined,
  ])('rechaza %s', (input) => {
    expect(safeRedirect(input)).toBeNull()
  })

  it('construye la URL del login con la ruta de retorno codificada', () => {
    expect(loginPathFor('/products?q=arroz')).toBe('/login?redirect=%2Fproducts%3Fq%3Darroz')
    expect(loginPathFor('/')).toBe('/login')
  })
})
