package com.cuartico.product;

import java.math.BigDecimal;
import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Order of {@code variants[]} (HU-16 CA-14): canonical sizes (XXS..XXXL, aliases 2XL and 3XL), then numeric sizes
 * from lowest to highest (decimals allowed), then the rest alphabetically, and variants without size last; with
 * the same size, by color alphabetically (colorless last), and finally by id.
 */
final class VariantOrder {

	private static final List<String> CANONICAL = List.of("XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL");

	private static final Map<String, String> ALIASES = Map.of("2XL", "XXL", "3XL", "XXXL");

	private static final Pattern NUMERIC = Pattern.compile("^[0-9]+(\\.[0-9]+)?$");

	/** Spanish collation at primary strength: ignores case and accents. */
	private static final Collator COLLATOR = newCollator();

	static final Comparator<ProductVariant> COMPARATOR = Comparator.comparingInt(VariantOrder::sizeClass)
		.thenComparingInt(VariantOrder::canonicalIndex)
		.thenComparing(VariantOrder::numericValue, Comparator.nullsFirst(Comparator.naturalOrder()))
		.thenComparing(VariantOrder::otherSize, Comparator.nullsFirst(COLLATOR))
		.thenComparing(ProductVariant::getColor, Comparator.nullsLast(COLLATOR))
		.thenComparing(ProductVariant::getId, Comparator.nullsLast(Comparator.naturalOrder()));

	private VariantOrder() {
	}

	private static Collator newCollator() {
		Collator collator = Collator.getInstance(Locale.forLanguageTag("es"));
		collator.setStrength(Collator.PRIMARY);
		return collator;
	}

	/** 0 canonical, 1 numeric, 2 other, 3 no size. */
	private static int sizeClass(ProductVariant v) {
		String size = v.getSize();
		if (size == null) {
			return 3;
		}
		if (CANONICAL.contains(canonical(size))) {
			return 0;
		}
		return NUMERIC.matcher(size).matches() ? 1 : 2;
	}

	private static int canonicalIndex(ProductVariant v) {
		return v.getSize() == null ? 0 : Math.max(CANONICAL.indexOf(canonical(v.getSize())), 0);
	}

	private static BigDecimal numericValue(ProductVariant v) {
		return v.getSize() != null && NUMERIC.matcher(v.getSize()).matches() ? new BigDecimal(v.getSize()) : null;
	}

	private static String otherSize(ProductVariant v) {
		return sizeClass(v) == 2 ? v.getSize() : null;
	}

	private static String canonical(String size) {
		return ALIASES.getOrDefault(size, size);
	}

}
