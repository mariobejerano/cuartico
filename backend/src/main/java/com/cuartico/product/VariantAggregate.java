package com.cuartico.product;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * Stock figures of a product over ALL its variants, active or not (HU-16 CA-15): desactivating a size does not
 * take its units out of the warehouse. One formula for the detail (computed in Java from the variants) and for
 * the list (the sums come from one GROUP BY, see {@link ProductVariantRepository#aggregateByProductIds}).
 *
 * <p>{@code costValue} = sum(onHand * averageCost) and {@code costedOnHand} = sum(onHand) over the variants that
 * have a cost. {@code sku}, {@code minStock}, {@code rawAverageCost} and {@code rawCostCurrency} are the values of
 * the only variant, meaningful for simple products.
 */
public record VariantAggregate(long variantCount, BigDecimal onHand, BigDecimal reserved, BigDecimal costValue,
		BigDecimal costedOnHand, boolean anyActiveVariantLow, String sku, BigDecimal minStock,
		BigDecimal rawAverageCost, String rawCostCurrency) {

	private static final int COST_SCALE = 4;

	private static final int QUANTITY_SCALE = 3;

	public static final String COST_CURRENCY = "USD";

	public static VariantAggregate empty() {
		return new VariantAggregate(0, zero(), zero(), null, null, false, null, null, null, null);
	}

	public static VariantAggregate of(Collection<ProductVariant> variants) {
		BigDecimal onHand = zero();
		BigDecimal reserved = zero();
		BigDecimal costValue = null;
		BigDecimal costedOnHand = null;
		boolean low = false;
		for (ProductVariant v : variants) {
			VariantStock s = v.getStock();
			onHand = onHand.add(s.getOnHand());
			reserved = reserved.add(s.getReserved());
			if (s.getAverageCost() != null) {
				BigDecimal value = s.getOnHand().multiply(s.getAverageCost());
				costValue = costValue == null ? value : costValue.add(value);
				costedOnHand = costedOnHand == null ? s.getOnHand() : costedOnHand.add(s.getOnHand());
			}
			low |= v.isLowStock();
		}
		ProductVariant only = variants.size() == 1 ? variants.iterator().next() : null;
		return new VariantAggregate(variants.size(), onHand, reserved, costValue, costedOnHand, low,
				only == null ? null : only.getSku(), only == null ? null : only.getMinStock(),
				only == null ? null : only.getStock().getAverageCost(),
				only == null ? null : only.getStock().getCostCurrency());
	}

	/** Row of {@link ProductVariantRepository#aggregateByProductIds}, from the product id on. */
	static VariantAggregate fromRow(Object[] row) {
		return new VariantAggregate(((Number) row[1]).longValue(), scaled(row[2]), scaled(row[3]),
				(BigDecimal) row[4], (BigDecimal) row[5], row[6] != null && ((Number) row[6]).intValue() > 0,
				(String) row[7], (BigDecimal) row[8], (BigDecimal) row[9], (String) row[10]);
	}

	/** Weighted average cost, 4 decimals HALF_UP; null when no variant with cost has units. */
	public BigDecimal weightedAverageCost() {
		if (costValue == null || costedOnHand == null || costedOnHand.signum() == 0) {
			return null;
		}
		return costValue.divide(costedOnHand, COST_SCALE, RoundingMode.HALF_UP);
	}

	private static BigDecimal scaled(Object value) {
		return value == null ? zero() : ((BigDecimal) value).setScale(QUANTITY_SCALE, RoundingMode.HALF_UP);
	}

	private static BigDecimal zero() {
		return BigDecimal.ZERO.setScale(QUANTITY_SCALE);
	}

}
