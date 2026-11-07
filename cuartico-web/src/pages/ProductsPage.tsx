import { useTranslation } from 'react-i18next'
import { Icon } from '../components/Icon'
import { useDocumentTitle } from '../components/useDocumentTitle'

/** Productos: marcador de posición hasta HU-02. */
export default function ProductsPage() {
  const { t } = useTranslation()
  useDocumentTitle('products.page_title')
  return (
    <>
      <div className="page-head">
        <h1 className="mobile-sr">{t('products.title')}</h1>
      </div>
      <section className="c-empty">
        <Icon name="empty" />
        <p>{t('products.coming_soon')}</p>
      </section>
    </>
  )
}
