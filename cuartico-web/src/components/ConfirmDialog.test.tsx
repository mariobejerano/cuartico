import { CSPProvider } from '@base-ui/react/csp-provider'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { installFakeApi, json } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'
import { ConfirmDialog } from './ConfirmDialog'

const styleCount = () => document.querySelectorAll('style').length

/** Un botón que abre el diálogo, como en las pantallas reales (el diálogo es "controlado" por el padre). */
function Harness({ busy = false, info = false, onConfirm = () => {} }: { busy?: boolean; info?: boolean; onConfirm?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <CSPProvider disableStyleElements>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <ConfirmDialog
        open={open}
        title="¿Desactivar «Arroz»?"
        cancelLabel={info ? undefined : 'Cancelar'}
        confirmLabel={info ? 'Entendido' : 'Desactivar'}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
      >
        <p>Podrás activarlo de nuevo.</p>
        <p>Segundo párrafo.</p>
      </ConfirmDialog>
    </CSPProvider>
  )
}

describe('Button (shadcn/ui sobre Base UI)', () => {
  it('es un <button type="button"> con su nombre accesible y respeta disabled', () => {
    render(
      <>
        <Button>Guardar</Button>
        <Button variant="outline" disabled>
          Cancelar
        </Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})

describe('ConfirmDialog (Dialog de shadcn/ui sobre Base UI)', () => {
  it('abre un diálogo con título y descripción accesibles; Cancelar cierra y devuelve el foco', async () => {
    const ue = userEvent.setup()
    render(<Harness />)
    await ue.click(screen.getByRole('button', { name: 'Abrir' }))

    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar «Arroz»?' })
    expect(dialog).toHaveAccessibleDescription(/Podrás activarlo de nuevo\./)
    expect(dialog).toContainElement(document.activeElement as HTMLElement) // el foco entra en el diálogo

    await ue.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('Escape llama a onCancel; Confirmar llama a onConfirm', async () => {
    const ue = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)

    await ue.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByRole('dialog')
    await ue.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()

    await ue.click(screen.getByRole('button', { name: 'Abrir' }))
    await ue.click(await screen.findByRole('button', { name: 'Desactivar' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('mientras está ocupado: botones deshabilitados y Escape no cierra', async () => {
    const ue = userEvent.setup()
    render(<Harness busy />)
    await ue.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desactivar' })).toHaveAttribute('aria-busy', 'true')
    await ue.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('informativo: un solo botón', async () => {
    const ue = userEvent.setup()
    render(<Harness info />)
    await ue.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = await screen.findByRole('dialog')
    expect(screen.getAllByRole('button').filter((b) => dialog.contains(b))).toHaveLength(1)
  })
})

describe('Guardarraíl CSP: ningún <style> en el DOM (ADR-004)', () => {
  it('al abrir el diálogo', async () => {
    const ue = userEvent.setup()
    render(<Harness />)
    await ue.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByRole('dialog')
    expect(styleCount()).toBe(0)
  })

  it('al renderizar la app completa', async () => {
    localStorage.setItem('cuartico.refreshToken', 'refresh-1')
    installFakeApi().on('POST /api/v1/auth/refresh', () => json(401))
    renderApp('/')
    await screen.findByRole('button', { name: 'Entrar' })
    expect(styleCount()).toBe(0)
  })

  it('control: el guardarraíl detecta un <style> real (ScrollArea de Base UI sin CSPProvider) y CSPProvider lo evita', () => {
    const area = (
      <ScrollArea.Root>
        <ScrollArea.Viewport>contenido</ScrollArea.Viewport>
      </ScrollArea.Root>
    )
    const withProvider = render(<CSPProvider disableStyleElements>{area}</CSPProvider>)
    expect(styleCount()).toBe(0)
    withProvider.unmount()

    render(area)
    expect(styleCount()).toBeGreaterThan(0) // así se vería una violación de CSP: el guardarraíl la detectaría
    // React 19 "eleva" ese <style> a <head> y lo deja tras desmontar: lo quitamos para que el guardarraíl global no salte.
    document.querySelectorAll('style').forEach((s) => s.remove())
  })
})
