import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectLanguage, LANG_KEY } from './index'

function browserLanguage(lang: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(lang)
}

afterEach(() => vi.restoreAllMocks())

describe('Idioma inicial (HU-01 CA-21)', () => {
  it.each(['en', 'en-US', 'en-GB', 'EN-us'])('navegador %s sin preferencia guardada -> inglés', (lang) => {
    browserLanguage(lang)
    expect(detectLanguage()).toBe('en')
  })

  it.each(['es', 'es-CU', 'fr-FR', 'de', 'pt-BR', ''])('navegador %s sin preferencia guardada -> español', (lang) => {
    browserLanguage(lang)
    expect(detectLanguage()).toBe('es')
  })

  it('la elección guardada manda sobre el navegador', () => {
    browserLanguage('en-US')
    localStorage.setItem(LANG_KEY, 'es')
    expect(detectLanguage()).toBe('es')
    browserLanguage('es-CU')
    localStorage.setItem(LANG_KEY, 'en')
    expect(detectLanguage()).toBe('en')
  })

  it('un valor guardado inválido se ignora', () => {
    browserLanguage('en-US')
    localStorage.setItem(LANG_KEY, 'xx')
    expect(detectLanguage()).toBe('en')
  })
})
