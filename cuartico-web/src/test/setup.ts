import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { wireApiClient } from '../app/wiring'
import { resetSessionForTests } from '../auth/session'
import i18n from '../i18n'

wireApiClient()

// findBy…/waitFor esperan hasta 5 s (por defecto 1 s): con la máquina cargada (p. ej. Maven a la vez) 1 s se queda corto.
// No ralentiza nada: en cuanto la condición se cumple, siguen.
configure({ asyncUtilTimeout: 5_000 })

// jsdom no implementa del todo <dialog>: lo justo para abrir y cerrar.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

beforeEach(async () => {
  localStorage.clear()
  resetSessionForTests()
  await i18n.changeLanguage('es')
})

afterEach(() => {
  // Guardarraíl CSP (ADR-004): con `css: false` ningún CSS nuestro llega al DOM de los tests, así que cualquier
  // <style> lo ha creado un componente en tiempo de ejecución, y en staging lo bloquearía `style-src 'self'`.
  const injected = document.querySelectorAll('style').length
  cleanup()
  if (injected > 0) {
    throw new Error(`CSP guardrail: ${injected} <style> element(s) injected at runtime (blocked by style-src 'self', ADR-004)`)
  }
})
