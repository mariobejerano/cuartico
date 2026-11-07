import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Hook propio: pone el título de la pestaña traducido y lo actualiza al cambiar de idioma.
 * Un hook personalizado es como un pequeño servicio reutilizable que cualquier componente puede "inyectar".
 */
export function useDocumentTitle(key: string) {
  const { t, i18n } = useTranslation()
  useEffect(() => {
    document.title = t(key)
  }, [t, key, i18n.language])
}
