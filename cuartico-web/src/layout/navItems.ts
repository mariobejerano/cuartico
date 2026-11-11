import type { IconName } from '../components/Icon'

/** Destinos del menú: barra lateral y barra inferior (CA-24). */
export const NAV_ITEMS: { to: string; labelKey: string; icon: IconName }[] = [
  { to: '/', labelKey: 'nav.home', icon: 'home' },
  { to: '/products', labelKey: 'nav.products', icon: 'box' },
]

/**
 * Módulos ocasionales («Gestión»), solo ADMIN (HU-15 CA-25, D-4): en la barra lateral debajo de Productos y, en móvil,
 * dentro de la hoja «Más». «Usuarios» llegará con HU-14.
 */
export const MANAGE_ITEMS: { to: string; labelKey: string; icon: IconName }[] = [
  { to: '/categories', labelKey: 'nav.categories', icon: 'tag' },
]
