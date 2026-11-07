import { useTranslation } from 'react-i18next'
import type { UserResponse } from '../api/types'
import { session } from '../auth/session'
import { Icon } from '../components/Icon'
import { LanguageSwitch } from '../components/LanguageSwitch'

/**
 * Zona de cuenta (HU-01 CA-24): nombre, rol, idioma y «Cerrar sesión».
 * La usan la barra lateral (escritorio) y la hoja inferior (móvil/tablet).
 * `nameId` permite que en la hoja el nombre sea el título (`h2`) del diálogo.
 */
export function AccountPanel({ user, nameId, onLogout }: { user: UserResponse; nameId?: string; onLogout?: () => void }) {
  const { t } = useTranslation()
  const logout = () => {
    onLogout?.()
    void session.logout() // CA-19: la guarda de rutas nos lleva al login al quedar anónimos
  }
  return (
    <div className="account-panel">
      <div>
        {nameId ? (
          <h2 id={nameId} className="user-name">
            {user.fullName}
          </h2>
        ) : (
          <div className="user-name">{user.fullName}</div>
        )}
        <span className="c-tag">{t(`role.${user.role}`)}</span>
      </div>
      <LanguageSwitch variant="select" />
      <button type="button" className="c-btn c-btn--secondary" onClick={logout}>
        <Icon name="logout" />
        <span>{t('nav.logout')}</span>
      </button>
    </div>
  )
}
