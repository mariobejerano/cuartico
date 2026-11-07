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

describe('safeRedirect: normalización que reintroduce // (HU-01 CA-6, redirección abierta)', () => {
  // `new URL` colapsa `/.` y `/a/..`: el resultado empieza por `//evil.com`, que el router tomaría por otro origen.
  it.each(['/.//evil.com', '/a/..//evil.com'])('rechaza %s', (input) => {
    const out = safeRedirect(input)
    expect(out === null || !out.startsWith('//')).toBe(true)
  })

  it.each([
    '/%2e//evil.com',
    '/%2E%2E//evil.com',
    '/a/%2e%2e//evil.com',
    '/./\\evil.com',
    '/.///evil.com',
    '/a/b/../..//evil.com',
    '/%2f%2fevil.com',
    '/%5cevil.com',
    '/./login',
    '/a/../login?x=1',
  ])('rechaza la variante %s', (input) => {
    expect(safeRedirect(input)).toBeNull()
  })

  it('normaliza rutas internas inofensivas', () => {
    expect(safeRedirect('/a/../products?q=arroz')).toBe('/products?q=arroz')
  })
})
