import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { useDocumentTitle } from '../components/useDocumentTitle'

/**
 * «No tienes acceso a esta página» (HU-15 CA-25): para un OPERATOR que llega por URL a una página solo de ADMIN.
 * Explica el porqué y da salida, en vez de un 404 engañoso. La seguridad real es el 403 del backend.
 */
export default function ForbiddenPage() {
  const { t } = useTranslation()
  useDocumentTitle('categories.page_title')
  return (
    <section className="c-empty">
      <Icon name="lock" />
      <h1>{t('forbidden.title')}</h1>
      <p>{t('forbidden.body')}</p>
      <Link className="c-btn c-btn--secondary" to="/products">
        {t('forbidden.go_products')}
      </Link>
    </section>
  )
}
