import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Pone a un botón de solo icono un tooltip con su propia etiqueta (la misma que su `aria-label`).
 * Se carga con `lazy()` y solo en ≥ 768 px: el Tooltip trae Floating UI (~20 KB gzip) y en el móvil, que no tiene
 * hover, no se usa. Así no pesa en la primera carga del login ni en móviles con red lenta.
 */
export default function LabelTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
