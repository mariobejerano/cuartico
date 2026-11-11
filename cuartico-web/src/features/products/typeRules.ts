import type { ProductType, UnitOfMeasure } from '../../api/types'

/**
 * Qué datos pide cada tipo de producto (HU-15 CA-16, CA-17, CA-26). Las mismas reglas que valida el backend;
 * aquí sirven para enseñar/ocultar campos y para no enviar nunca algo que el servidor rechazaría.
 */

/** Modelo y garantía solo existen en electrodomésticos (CA-16). */
export const usesApplianceFields = (type: ProductType | null) => type === 'APPLIANCE'

/** Ropa y electrodomésticos se cuentan siempre por unidades (CA-17). */
export const isUnitLocked = (type: ProductType | null) => type === 'CLOTHING' || type === 'APPLIANCE'

export const LOCKED_UNIT: UnitOfMeasure = 'UNIT'

/** Lo que conviene avisar al pasar de un tipo a otro (aviso ámbar bajo la categoría, CA-26). */
export interface TypeChangeNotes {
  /** Se perderán modelo y/o garantía ya escritos. */
  dropsApplianceFields: boolean
  /** La unidad elegida pasa a «Unidad (u)»: tipo que lo impone, o `null`. */
  unitLockedBy: ProductType | null
}

export function typeChangeNotes(
  from: ProductType | null,
  to: ProductType | null,
  values: { model: string; warrantyMonths: string; unit: string },
): TypeChangeNotes {
  const hadApplianceData = !!values.model.trim() || !!values.warrantyMonths.trim()
  return {
    dropsApplianceFields: usesApplianceFields(from) && !usesApplianceFields(to) && hadApplianceData,
    unitLockedBy: isUnitLocked(to) && values.unit !== '' && values.unit !== LOCKED_UNIT ? to : null,
  }
}
