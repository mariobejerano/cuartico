import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { wireApiClient } from '../app/wiring'
import { resetSessionForTests } from '../auth/session'
import i18n from '../i18n'

wireApiClient()

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
