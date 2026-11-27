import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

/*
 * Tooltip de shadcn/ui sobre Base UI (design system v0.2 §7.12): 14 px, `bg-foreground text-background`, aparece con
 * hover y con foco de teclado. Solo en ≥ 768 px (en móvil no hay hover): lo decide quien lo usa.
 * Base UI lo coloca con Floating UI escribiendo `top/left` por CSSOM (permitido por la CSP; no crea `<style>`).
 * Nunca es la única forma de saber qué hace un botón: el botón lleva su `aria-label`, el tooltip lo repite a la vista.
 *
 *   <Tooltip>
 *     <TooltipTrigger render={<Button aria-label={label} … />} />
 *     <TooltipContent>{label}</TooltipContent>
 *   </Tooltip>
 */

type WithClassName<P> = Omit<P, 'className'> & { className?: string }

const Tooltip = TooltipPrimitive.Root

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" delay={300} {...props} />
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 6,
  children,
  ...props
}: WithClassName<TooltipPrimitive.Popup.Props> & Pick<TooltipPrimitive.Positioner.Props, 'side' | 'sideOffset'>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-(--z-toast)">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-sm text-background shadow-md',
            'transition-opacity duration-(--duration-fast) data-starting-style:opacity-0 data-ending-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
