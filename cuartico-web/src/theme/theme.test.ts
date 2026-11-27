import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTheme, resetThemeForTests, setTheme, subscribeTheme, toggleTheme } from './theme'

/** `matchMedia` falso: el "dispositivo" está en modo oscuro o no, y podemos cambiarlo como el modo noche automático. */
function fakeDevice(dark: boolean) {
  const listeners = new Set<() => void>()
  const mql = {
    get matches() {
      return dark
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    switchTo(next: boolean) {
      dark = next
      listeners.forEach((fn) => fn())
    },
  }
}

const attr = () => document.documentElement.getAttribute('data-theme')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tema claro/oscuro (design system §7.12)', () => {
  it('sin elección guardada sigue al dispositivo, también en vivo, y no pone data-theme', () => {
    const device = fakeDevice(false)
    resetThemeForTests()
    const onChange = vi.fn()
    const unsubscribe = subscribeTheme(onChange)

    expect(getTheme()).toBe('light')
    device.switchTo(true) // el móvil pasa a modo noche
    expect(onChange).toHaveBeenCalled()
    expect(getTheme()).toBe('dark')
    expect(attr()).toBeNull() // los colores los cambia el CSS (@media), no hace falta atributo
    unsubscribe()
  })

  it('al elegir: data-theme en <html>, se guarda en el navegador y el dispositivo deja de mandar', () => {
    const device = fakeDevice(false)
    resetThemeForTests()
    const onChange = vi.fn()
    const unsubscribe = subscribeTheme(onChange)

    expect(toggleTheme()).toBe('dark')
    expect(attr()).toBe('dark')
    expect(localStorage.getItem('cuartico.theme')).toBe('dark')
    expect(onChange).toHaveBeenCalledTimes(1)

    device.switchTo(false)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(getTheme()).toBe('dark')
    unsubscribe()
  })

  it('una pestaña nueva recupera la elección guardada', () => {
    fakeDevice(false)
    localStorage.setItem('cuartico.theme', 'dark')
    resetThemeForTests()
    expect(getTheme()).toBe('dark')
    expect(attr()).toBe('dark')

    localStorage.setItem('cuartico.theme', 'sepia') // valor desconocido: se ignora
    resetThemeForTests()
    expect(getTheme()).toBe('light')
  })

  it('sin localStorage (navegación privada, bloqueado): la elección vale en memoria y no falla nada', () => {
    fakeDevice(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    resetThemeForTests()
    expect(getTheme()).toBe('light')
    expect(() => setTheme('dark')).not.toThrow()
    expect(getTheme()).toBe('dark')
    expect(attr()).toBe('dark')
  })

  it('si otra pestaña elige tema, esta lo sigue', () => {
    fakeDevice(false)
    resetThemeForTests()
    const onChange = vi.fn()
    const unsubscribe = subscribeTheme(onChange)

    window.dispatchEvent(new StorageEvent('storage', { key: 'cuartico.theme', newValue: 'dark' }))
    expect(getTheme()).toBe('dark')
    expect(attr()).toBe('dark')
    expect(onChange).toHaveBeenCalled()
    unsubscribe()
  })

  it('con elección, las <meta name="theme-color"> llevan el color de ese tema', () => {
    fakeDevice(false)
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#134e4a" media="(prefers-color-scheme: light)">' +
        '<meta name="theme-color" content="#102624" media="(prefers-color-scheme: dark)">',
    )
    resetThemeForTests()
    setTheme('dark')
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    expect(metas.map((m) => m.content)).toEqual(['#102624', '#102624'])
    metas.forEach((m) => m.remove())
  })
})
