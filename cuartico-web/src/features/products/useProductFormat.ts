import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnitOfMeasure } from '../../api/types'
import { formatDateTime, formatMoney, formatQuantity } from './format'

/**
 * Formateadores ya atados al idioma actual. Hook personalizado = pequeño servicio reutilizable:
 * cualquier componente lo "inyecta" con una línea y, al cambiar de idioma, todo se vuelve a formatear.
 */
export function useProductFormat() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const money = useCallback(
    (amount: number | null, currency: string | null) =>
      amount === null || currency === null ? t('products.no_price') : formatMoney(amount, currency, lang),
    [t, lang],
  )
  const quantity = useCallback(
    (amount: number, unit: UnitOfMeasure) => formatQuantity(amount, t(`unit_short.${unit}`), lang),
    [t, lang],
  )
  const dateTime = useCallback((iso: string) => formatDateTime(iso, lang), [lang])
  return useMemo(() => ({ lang, money, quantity, dateTime }), [lang, money, quantity, dateTime])
}
