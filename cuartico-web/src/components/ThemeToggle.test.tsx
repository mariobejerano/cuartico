import { CSPProvider } from '@base-ui/react/csp-provider'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeLanguage } from '../i18n'
import { installFakeApi, json } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Botón sol/luna (design system §7.12, copy.md §11)', () => {
  it('en claro dice «Cambiar a modo oscuro»; al pulsar cambia al instante, se queda el foco y se anuncia', async () => {
    const ue = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: 'Cambiar a modo oscuro' })
    expect(button).not.toHaveAttribute('aria-pressed') // botón de acción: el nombre es el verbo
    await ue.click(button)

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('cuartico.theme')).toBe('dark')
    expect(button).toHaveAccessibleName('Cambiar a modo claro')
    expect(button).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Modo oscuro activado')

    await ue.click(button)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('status')).toHaveTextContent('Modo claro activado')
  })

  it('en inglés: «Switch to dark mode»', async () => {
    await changeLanguage('en')
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })

  it('desde 768 px muestra el tooltip con el foco de teclado, sin crear <style> (CSP)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 768px)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const ue = userEvent.setup()
    render(
      <CSPProvider disableStyleElements>
        <ThemeToggle />
      </CSPProvider>,
    )
    // El tooltip se descarga aparte (lazy): esperamos a que esté montado antes de enfocar.
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-trigger"]')).not.toBeNull())
    await ue.tab()
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toHaveFocus()
    expect(await screen.findByText('Cambiar a modo oscuro', { selector: '[data-slot="tooltip-content"]' })).toBeVisible()
    expect(document.querySelectorAll('style')).toHaveLength(0)
  })

  it('está en el login, junto al idioma, y el tema elegido no se borra al entrar ni al salir', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => json(401))
    const ue = userEvent.setup()
    renderApp('/')
    await ue.click(await screen.findByRole('button', { name: 'Cambiar a modo oscuro' }))
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
    expect(localStorage.getItem('cuartico.theme')).toBe('dark')
  })
})
