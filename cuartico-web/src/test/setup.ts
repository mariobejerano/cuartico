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
  cleanup()
})
