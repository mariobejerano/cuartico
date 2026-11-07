import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCurrentUser } from '../auth/useSession'
import { Icon } from '../components/Icon'
import { useDocumentTitle } from '../components/useDocumentTitle'

/** Inicio: vacío en este sprint (HU-01). */
export default function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle('home.page_title')
  const user = useCurrentUser()
  return (
    <>
      <div className="page-head">
        <h1 className="mobile-sr">{t('home.title')}</h1>
      </div>
      <section className="c-empty">
        <Icon name="home" />
        {user && <h2>{t('home.greeting', { name: user.fullName })}</h2>}
        <p>{t('home.empty')}</p>
        <Link className="c-btn c-btn--secondary" to="/products">
          {t('home.go_to_products')}
        </Link>
      </section>
    </>
  )
}
