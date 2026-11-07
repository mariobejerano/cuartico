import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { useDocumentTitle } from '../components/useDocumentTitle'

/** Ruta desconocida dentro del panel (HU-01 CA-26). */
export default function NotFoundPage() {
  const { t } = useTranslation()
  useDocumentTitle('not_found.page_title')
  return (
    <section className="c-empty">
      <Icon name="alert" />
      <h1>{t('not_found.title')}</h1>
      <p>{t('not_found.body')}</p>
      <Link className="c-btn c-btn--primary" to="/">
        {t('not_found.home_link')}
      </Link>
    </section>
  )
}
