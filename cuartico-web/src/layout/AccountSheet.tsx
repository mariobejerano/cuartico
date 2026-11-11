import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import type { UserResponse } from '../api/types'
import { hasRole } from '../auth/roles'
import { Icon } from '../components/Icon'
import { MANAGE_ITEMS } from './navItems'
import { AccountPanel } from './AccountPanel'

/**
 * Hoja inferior con la zona de cuenta (móvil y tablet). Usa `<dialog>` nativo:
 * el navegador ya gestiona el foco, la tecla Escape y el fondo oscuro, sin librerías.
 */
export function AccountSheet({ user, open, onClose }: { user: UserResponse; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  // Efecto: sincroniza el estado de React (`open`) con el <dialog> del navegador.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="c-modal" aria-labelledby="account-sheet-name" onClose={onClose}>
      <div className="c-modal__body">
        <AccountPanel user={user} nameId="account-sheet-name" onLogout={onClose}>
          {hasRole(user, 'ADMIN') && (
            // Hoja «Más» del ADMIN (HU-15 D-4): módulos ocasionales arriba, la cuenta debajo.
            <>
              <div>
                <p className="sheet-section">{t('nav.manage')}</p>
                <ul className="sheet-list">
                  {MANAGE_ITEMS.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} onClick={onClose}>
                        <Icon name={item.icon} />
                        <span>{t(item.labelKey)}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="sheet-section">{t('nav.account_short')}</p>
            </>
          )}
        </AccountPanel>
      </div>
      <div className="c-modal__actions">
        <button type="button" className="c-btn c-btn--secondary c-btn--block" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </dialog>
  )
}
