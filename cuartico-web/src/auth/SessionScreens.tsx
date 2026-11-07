import { useTranslation } from 'react-i18next'
import { ErrorAlert } from '../components/ErrorAlert'
import { messageForError } from '../components/errorMessage'
import { ServerWakingNotice } from '../components/ServerWakingNotice'
import { session } from './session'
import type { ApiError } from '../api/errors'

/** «Comprobando tu sesión…» a pantalla completa mientras se llama a /auth/refresh al arrancar (CA-11). */
export function CheckingSession() {
  const { t } = useTranslation()
  return (
    <div className="fullscreen-status">
      <div className="fullscreen-status__box">
        <div role="status">
          <div className="spinner spinner--lg" aria-hidden="true" />
          <p>{t('login.checking_session')}</p>
        </div>
        <ServerWakingNotice />
      </div>
    </div>
  )
}

/** No se pudo comprobar la sesión por red o servidor: se conserva el refresh y se ofrece «Reintentar» (CA-9). */
export function SessionUnreachable({ error }: { error: ApiError }) {
  return (
    <div className="fullscreen-status">
      <div className="fullscreen-status__box">
        <ErrorAlert message={messageForError(error)} onRetry={() => void session.bootstrap()} />
      </div>
    </div>
  )
}
