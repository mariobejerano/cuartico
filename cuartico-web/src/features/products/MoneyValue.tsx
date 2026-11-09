import { useTranslation } from 'react-i18next'
import { useProductFormat } from './useProductFormat'

/**
 * Importe con su moneda («3,50 USD»). Si no hay valor se ve «—», pero un lector de pantalla leería «guion» o nada:
 * por eso el «—» va con `aria-hidden` y al lado, oculto a la vista, «Sin definir» (`common.not_set`).
 */
export function MoneyValue({ amount, currency }: { amount: number | null; currency: string | null }) {
  const { t } = useTranslation()
  const fmt = useProductFormat()
  if (amount !== null && currency !== null) return <>{fmt.money(amount, currency)}</>
  return (
    <>
      <span aria-hidden="true">{t('products.no_price')}</span>
      <span className="visually-hidden">{t('common.not_set')}</span>
    </>
  )
}
