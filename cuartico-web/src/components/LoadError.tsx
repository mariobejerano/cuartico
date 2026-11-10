import { useTranslation } from 'react-i18next'
import { isApiError } from '../api/errors'
import { Icon } from './Icon'

/**
 * Error al cargar una pantalla: de red (icono sin conexión) o del servidor (con `detail` y código para soporte).
 * Lo comparten el listado de productos y el árbol de categorías. `titleKey` = título del error del servidor.
 */
export function LoadError({ error, titleKey, onRetry }: { error: unknown; titleKey: string; onRetry: () => void }) {
  const { t } = useTranslation()
  const network = !isApiError(error) || error.kind === 'network'
  return (
    <section className="c-empty is-error">
      <Icon name={network ? 'cloud-off' : 'alert'} />
      <h2>{t(network ? 'net.unreachable_title' : titleKey)}</h2>
      <p>{network ? t('net.unreachable_body') : (isApiError(error) && error.detail) || t('net.unexpected_generic')}</p>
      {!network && isApiError(error) && error.code && (
        <p className="code">{t('products.error_code', { code: error.code })}</p>
      )}
      <button type="button" className="c-btn c-btn--secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </section>
  )
}
