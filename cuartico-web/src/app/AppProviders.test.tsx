import { ScrollArea } from '@base-ui/react/scroll-area'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppProviders } from './AppProviders'
import { createQueryClient } from './wiring'

describe('AppProviders', () => {
  it('incluye CSPProvider: un componente de Base UI que crearía un <style> no lo crea (ADR-004)', () => {
    // ScrollArea.Viewport crea un <style> sin CSPProvider (lo demuestra el test de control de ConfirmDialog.test.tsx).
    // Si alguien quita CSPProvider de AppProviders (y por tanto de App.tsx), este test falla.
    render(
      <AppProviders queryClient={createQueryClient()}>
        <ScrollArea.Root>
          <ScrollArea.Viewport>contenido</ScrollArea.Viewport>
        </ScrollArea.Root>
      </AppProviders>,
    )
    expect(document.querySelectorAll('style')).toHaveLength(0)
  })
})
