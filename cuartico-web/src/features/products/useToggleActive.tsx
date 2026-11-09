import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProductResponse } from '../../api/types'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { messageForError } from '../../components/errorMessage'
import { useToast } from '../../components/toast'
import { useSetProductActive } from './queries'
import { useProductFormat } from './useProductFormat'

/**
 * Flujo de activar / desactivar (solo ADMIN, CA-13 a CA-15), compartido por el listado y el formulario:
 * - Activar: directo, sin confirmación (no es arriesgado) y aviso «activado».
 * - Desactivar: diálogo de confirmación, con aviso ámbar si aún tiene stock (CA-14), y después un aviso con
 *   «Deshacer» que lo vuelve a activar.
 *
 * Devuelve `toggle(producto)` para los botones y `dialog`, el diálogo que hay que pintar en algún sitio.
 * `onChanged` recibe el producto tal como lo devolvió la API (nueva versión incluida).
 */
export function useToggleActive(onChanged?: (saved: ProductResponse) => void): {
  toggle: (product: ProductResponse) => void
  dialog: ReactNode
} {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  const toast = useToast()
  const mutation = useSetProductActive()
  const [confirming, setConfirming] = useState<ProductResponse | null>(null)

  const showError = (e: unknown) => {
    const m = messageForError(e)
    toast({ variant: 'danger', text: m.text ?? t(m.titleKey ?? m.bodyKey ?? 'net.unexpected_generic') })
  }

  const activate = (product: ProductResponse, announce: boolean) =>
    mutation.mutate(
      { id: product.id, active: true },
      {
        onSuccess: (saved) => {
          if (announce) toast({ text: t('products.activated', { name: saved.name }) })
          onChanged?.(saved)
        },
        onError: showError,
      },
    )

  const confirmDeactivate = () => {
    if (!confirming) return
    mutation.mutate(
      { id: confirming.id, active: false },
      {
        onSuccess: (saved) => {
          setConfirming(null)
          toast({
            text: t('products.deactivated', { name: saved.name }),
            action: { label: t('common.undo'), run: () => activate(saved, false) },
          })
          onChanged?.(saved)
        },
        onError: (e) => {
          setConfirming(null)
          showError(e)
        },
      },
    )
  }

  const toggle = (product: ProductResponse) => {
    if (mutation.isPending) return
    if (product.active) setConfirming(product)
    else activate(product, true)
  }

  const p = confirming
  const hasStock = !!p && (p.stock.onHand > 0 || p.stock.reserved > 0)
  const dialog = (
    <ConfirmDialog
      open={!!p}
      title={p ? t('products.deactivate_title', { name: p.name }) : ''}
      cancelLabel={t('common.cancel')}
      confirmLabel={<span>{t(mutation.isPending ? 'products.deactivating' : 'products.deactivate')}</span>}
      busy={mutation.isPending}
      onCancel={() => setConfirming(null)}
      onConfirm={confirmDeactivate}
    >
      <p>{t('products.deactivate_body')}</p>
      {p && hasStock && (
        <Alert variant="warning">
          {t('products.deactivate_stock', {
            onHand: fmt.quantity(p.stock.onHand, p.unit),
            reserved: fmt.quantity(p.stock.reserved, p.unit),
          })}
        </Alert>
      )}
    </ConfirmDialog>
  )

  return { toggle, dialog }
}
