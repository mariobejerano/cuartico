import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useCurrentUser } from '../auth/useSession'
import { BrandMark, Icon, type IconName } from '../components/Icon'
import { ServerWakingNotice } from '../components/ServerWakingNotice'
import { AccountPanel } from './AccountPanel'
import { initials } from './initials'
import { AccountSheet } from './AccountSheet'

/** Destinos del menú en este sprint (CA-24). «Usuarios» llegará con HU-14. */
const NAV_ITEMS: { to: string; labelKey: string; icon: IconName }[] = [
  { to: '/', labelKey: 'nav.home', icon: 'home' },
  { to: '/products', labelKey: 'nav.products', icon: 'box' },
]

function titleKeyFor(pathname: string): string {
  const item = NAV_ITEMS.find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))
  return item?.labelKey ?? 'app.name'
}

/**
 * Esqueleto del panel (HU-01 CA-24, prototipo products.html):
 * - móvil (< 768 px): barra superior + barra inferior «Inicio · Productos · Cuenta»;
 * - tablet (768–1023 px): barra lateral de iconos;
 * - escritorio (≥ 1024 px): barra lateral con textos y la cuenta al pie.
 * Qué se ve en cada tamaño lo decide el CSS (media queries), no JavaScript.
 * `<Outlet />` es el hueco donde el router pinta la página actual (como un `th:replace` de Thymeleaf).
 */
export function AppLayout() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)

  if (!user) return null // RequireAuth ya lo garantiza; esto solo satisface a TypeScript
  const avatarLabel = t('nav.account', { name: user.fullName })

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('common.skip_to_content')}
      </a>

      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label={t('app.name')}>
          <BrandMark />
          <span className="label">{t('app.name')}</span>
        </NavLink>
        <nav aria-label={t('nav.main')}>
          <ul className="nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'}>
                  <Icon name={item.icon} />
                  <span className="label">{t(item.labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="account-full">
            <AccountPanel user={user} />
          </div>
          <button
            type="button"
            className="avatar-btn avatar-btn--sidebar"
            aria-haspopup="dialog"
            aria-label={avatarLabel}
            onClick={() => setAccountOpen(true)}
          >
            {initials(user.fullName)}
          </button>
        </div>
      </aside>

      <header className="topbar">
        <p className="topbar-title" aria-hidden="true">
          {t(titleKeyFor(pathname))}
        </p>
        <button
          type="button"
          className="avatar-btn"
          aria-haspopup="dialog"
          aria-label={avatarLabel}
          onClick={() => setAccountOpen(true)}
        >
          {initials(user.fullName)}
        </button>
      </header>

      <main id="main" className="app-main" tabIndex={-1}>
        <div className="alerts">
          <ServerWakingNotice />
        </div>
        <Suspense fallback={<div className="spinner" role="status" aria-label={t('common.loading')} />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="bottomnav" aria-label={t('nav.main')}>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'}>
                <Icon name={item.icon} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" aria-haspopup="dialog" onClick={() => setAccountOpen(true)}>
              <Icon name="user" />
              <span>{t('nav.account_short')}</span>
            </button>
          </li>
        </ul>
      </nav>

      <AccountSheet user={user} open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  )
}
