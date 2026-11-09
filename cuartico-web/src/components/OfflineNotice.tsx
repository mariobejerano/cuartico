import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from './Alert'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** `false` cuando el navegador sabe que no hay red (modo avión, wifi caído). */
function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}

/** Alerta ámbar persistente mientras no haya conexión (ux-notes/products.md §2, «Sin conexión»). */
export function OfflineNotice() {
  const { t } = useTranslation()
  const online = useOnline()
  if (online) return null
  return <Alert variant="warning">{t('common.offline')}</Alert>
}
