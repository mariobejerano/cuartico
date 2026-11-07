import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { netStatus } from '../api/netStatus'
import { Alert } from './Alert'

/**
 * «El servidor se está despertando…» mientras alguna petición lleve más de 5 s (HU-01 CA-8).
 * `useSyncExternalStore` conecta React con un almacén que vive fuera de React (`netStatus`):
 * cuando el almacén avisa, React vuelve a pintar este componente.
 */
export function ServerWakingNotice() {
  const { t } = useTranslation()
  const waking = useSyncExternalStore(netStatus.subscribe, netStatus.isWaking)
  if (!waking) return null
  return <Alert variant="info" title={t('net.waking_title')}>{t('net.waking_body')}</Alert>
}
