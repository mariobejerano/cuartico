import { useTranslation } from 'react-i18next'
import { Alert } from './Alert'
import type { UiMessage } from './errorMessage'

/** Pinta un `UiMessage` de error, con «Reintentar» si procede. */
export function ErrorAlert({ message, onRetry }: { message: UiMessage; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert
      variant="danger"
      title={message.titleKey && t(message.titleKey)}
      action={
        message.retry && onRetry ? (
          <button type="button" className="c-btn c-btn--secondary" onClick={onRetry}>
            {t('common.retry')}
          </button>
        ) : undefined
      }
    >
      {message.text ?? (message.bodyKey && t(message.bodyKey))}
    </Alert>
  )
}
