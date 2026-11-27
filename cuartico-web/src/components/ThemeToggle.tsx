import { Moon, Sun } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Theme } from '../theme/theme'
import { useTheme } from '../theme/useTheme'
import { DESKTOP_QUERY, useMediaQuery } from './useMediaQuery'

const LabelTooltip = lazy(() => import('./LabelTooltip'))

/**
 * Botón sol / luna (design system v0.2 §7.12, textos de copy.md §11).
 * - El icono y la etiqueta dicen el modo AL QUE VAS: en claro, luna y «Cambiar a modo oscuro»; en oscuro, sol y
 *   «Cambiar a modo claro». Es un "botón de acción": sin `aria-pressed`, el nombre accesible es el verbo.
 * - Al pulsar, el foco se queda en el botón y una región `role="status"` oculta anuncia «Modo oscuro activado»
 *   (no todos los lectores de pantalla releen la etiqueta nueva del botón enfocado).
 * - Tooltip con el mismo texto solo en ≥ 768 px (en móvil no hay hover). Mientras se descarga, el botón sin tooltip.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { theme, toggle } = useTheme()
  const desktop = useMediaQuery(DESKTOP_QUERY)
  // Guardamos el TEMA (no el texto traducido): si se cambia de idioma, el anuncio también cambia.
  const [announced, setAnnounced] = useState<Theme | null>(null)

  const label = t(theme === 'dark' ? 'theme.toggle_to_light' : 'theme.toggle_to_dark')
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const button = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn('text-current', className)}
      onClick={() => setAnnounced(toggle())}
    >
      <ThemeIcon aria-hidden="true" className="size-5" />
    </Button>
  )

  return (
    <>
      {desktop ? (
        <Suspense fallback={button}>
          <LabelTooltip label={label}>{button}</LabelTooltip>
        </Suspense>
      ) : (
        button
      )}
      <span role="status" className="sr-only">
        {announced && t(announced === 'dark' ? 'theme.dark_on' : 'theme.light_on')}
      </span>
    </>
  )
}
