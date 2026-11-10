package com.cuartico.category;

/**
 * Product type (ADR-003, decision 2). Declared on a root category and inherited by its descendants;
 * the type of a product is the one of its category. Behavior per type lives in code, not in names.
 */
public enum ProductType {

	FOOD, CLOTHING, APPLIANCE, OTHER;

	/** Only appliances carry model and warranty. */
	public boolean allowsModelAndWarranty() {
		return this == APPLIANCE;
	}

	/** Clothing and appliances are counted in whole units only. */
	public boolean requiresUnitOnly() {
		return this == CLOTHING || this == APPLIANCE;
	}

}
