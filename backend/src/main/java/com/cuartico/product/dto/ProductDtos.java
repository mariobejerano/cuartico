package com.cuartico.product.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

import com.cuartico.category.CategoryTree;
import com.cuartico.category.ProductType;
import com.cuartico.category.dto.CategoryDtos.CategoryRef;
import com.cuartico.common.Normalize;
import com.cuartico.product.Product;
import com.cuartico.product.ProductVariant;
import com.cuartico.product.UnitOfMeasure;
import com.cuartico.product.VariantAggregate;
import com.cuartico.product.VariantStock;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** DTOs of the product module. Entities never leave through the API. */
public final class ProductDtos {

	private static final String SKU_REGEX = "^[A-Za-z0-9._-]*$";

	/** Maximum variants per request (HU-16 CA-4). */
	public static final int MAX_VARIANTS = 100;

	private ProductDtos() {
	}

	/**
	 * Strips and upper-cases a SKU. The upper-casing is applied only to a value that is already valid:
	 * otherwise it could turn an invalid SKU into a valid one (TT-14: the German sharp s becomes "SS", dotless
	 * i becomes "I"). An invalid value is left untouched so the pattern validation answers 400.
	 */
	static String normalizeSku(String sku) {
		String value = Normalize.blankToNull(sku);
		if (value == null || !value.matches(SKU_REGEX)) {
			return value;
		}
		return value.toUpperCase(Locale.ROOT);
	}

	/** Size: trimmed and upper-cased (" m " -> "M"); blank -> null (HU-16 CA-6). */
	static String normalizeSize(String size) {
		String value = Normalize.blankToNull(size);
		return value == null ? null : value.toUpperCase(Locale.ROOT);
	}

	/*
	 * Normalization lives in the compact constructors: Jackson builds the record with the values
	 * already normalized and Bean Validation runs afterwards on them. salePriceCurrency is NOT
	 * normalized on purpose: "usd" must answer product.currency_unsupported.
	 */

	/**
	 * A variant to create. {@code sku} is optional; at least one of {@code size}/{@code color} is required, which the
	 * service checks (variant.options_required) so the error carries its own code.
	 */
	public record VariantRequest(
			@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
			@Size(max = 20) String size,
			@Size(max = 30) String color,
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock) {

		public VariantRequest {
			sku = normalizeSku(sku);
			size = normalizeSize(size);
			color = Normalize.blankToNull(color);
		}

	}

	public record UpdateVariantRequest(
			@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
			@Size(max = 20) String size,
			@Size(max = 30) String color,
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock,
			@NotNull Long version) {

		public UpdateVariantRequest {
			sku = normalizeSku(sku);
			size = normalizeSize(size);
			color = Normalize.blankToNull(color);
		}

	}

	public record AddVariantsRequest(
			@NotEmpty @Size(max = MAX_VARIANTS) List<@Valid @NotNull VariantRequest> variants) {
	}

	/** Options for the existing variant when a simple product becomes a product with variants (CA-12). */
	public record EnableVariantsRequest(@Size(max = 20) String size, @Size(max = 30) String color) {

		public EnableVariantsRequest {
			size = normalizeSize(size);
			color = Normalize.blankToNull(color);
		}

	}

	/**
	 * {@code hasVariants} absent or false: a simple product, with {@code sku} and {@code minStock} (minStock is required
	 * then: the service checks it); true: {@code variants} (1-100) and no product-level {@code sku}/{@code minStock}.
	 */
	public record CreateProductRequest(
			@NotBlank @Size(max = 120) String name,
			@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
			@NotNull UnitOfMeasure unit,
			@NotNull Long categoryId,
			@Size(max = 80) String brand,
			@Size(max = 80) String model,
			@Min(0) @Max(120) Integer warrantyMonths,
			@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal salePrice,
			String salePriceCurrency,
			@DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock,
			Boolean hasVariants,
			@Size(max = MAX_VARIANTS) List<@Valid @NotNull VariantRequest> variants) {

		public CreateProductRequest {
			name = name == null ? null : name.strip();
			sku = normalizeSku(sku);
			brand = Normalize.blankToNull(brand);
			model = Normalize.blankToNull(model);
		}

		public boolean withVariants() {
			return Boolean.TRUE.equals(hasVariants);
		}

	}

	/** The PUT never changes {@code hasVariants} or the variants (they have their own endpoints). */
	public record UpdateProductRequest(
			@NotBlank @Size(max = 120) String name,
			@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
			@NotNull UnitOfMeasure unit,
			@NotNull Long categoryId,
			@Size(max = 80) String brand,
			@Size(max = 80) String model,
			@Min(0) @Max(120) Integer warrantyMonths,
			@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal salePrice,
			String salePriceCurrency,
			@DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock,
			@NotNull Long version) {

		public UpdateProductRequest {
			name = name == null ? null : name.strip();
			sku = normalizeSku(sku);
			brand = Normalize.blankToNull(brand);
			model = Normalize.blankToNull(model);
		}

	}

	/** List parameters; a record with @ModelAttribute instead of Pageable so size is never clamped silently. */
	public record ProductQuery(
			@Size(max = 100) String q,
			Boolean active,
			Long categoryId,
			ProductType type,
			@Min(0) Integer page,
			@Min(1) @Max(100) Integer size,
			String sort) {

		public static final int DEFAULT_SIZE = 20;

		public ProductQuery {
			q = Normalize.blankToNull(q);
			sort = Normalize.blankToNull(sort);
		}

		public int pageOrDefault() {
			return page == null ? 0 : page;
		}

		public int sizeOrDefault() {
			return size == null ? DEFAULT_SIZE : size;
		}

		public String sortOrDefault() {
			return sort == null ? "name,asc" : sort;
		}

	}

	public record StockSummary(BigDecimal onHand, BigDecimal reserved, BigDecimal available, BigDecimal averageCost,
			String costCurrency) {

		static StockSummary from(VariantStock stock) {
			return new StockSummary(stock.getOnHand(), stock.getReserved(), stock.available(), stock.getAverageCost(),
					stock.getCostCurrency());
		}

		/**
		 * Stock of a product. Simple: the one of its only variant, as in HU-02. With variants: the aggregate over all
		 * of them (CA-15), where the average cost is the weighted one, never a sum of averages.
		 */
		static StockSummary from(VariantAggregate agg, boolean hasVariants) {
			BigDecimal available = agg.onHand().subtract(agg.reserved());
			if (!hasVariants) {
				return new StockSummary(agg.onHand(), agg.reserved(), available, agg.rawAverageCost(),
						agg.rawCostCurrency());
			}
			BigDecimal averageCost = agg.weightedAverageCost();
			return new StockSummary(agg.onHand(), agg.reserved(), available, averageCost,
					averageCost == null ? null : VariantAggregate.COST_CURRENCY);
		}

	}

	public record VariantResponse(Long id, String sku, String size, String color, BigDecimal minStock, boolean active,
			StockSummary stock, boolean lowStock, long version) {

		static VariantResponse from(ProductVariant v, boolean productActive) {
			return new VariantResponse(v.getId(), v.getSku(), v.getSize(), v.getColor(), v.getMinStock(), v.isActive(),
					StockSummary.from(v.getStock()), productActive && v.isLowStock(), v.getVersion());
		}

	}

	/**
	 * {@code sku} and {@code minStock} are the ones of the only variant for a simple product and null otherwise.
	 * {@code variants} comes only in the detail (and after create/edit/convert), not in the list.
	 */
	public record ProductResponse(Long id, String name, String sku, UnitOfMeasure unit, ProductType type,
			CategoryRef category, String brand, String model, Integer warrantyMonths, BigDecimal salePrice,
			String salePriceCurrency, BigDecimal minStock, boolean active, boolean hasVariants, int variantCount,
			StockSummary stock, boolean lowStock, @JsonInclude(JsonInclude.Include.NON_NULL) List<VariantResponse> variants,
			long version, Instant createdAt, String createdBy, Instant updatedAt, String updatedBy) {

		/** Detail: {@code sortedVariants} already in the order of CA-14. */
		public static ProductResponse detail(Product p, CategoryTree tree, List<ProductVariant> sortedVariants) {
			List<VariantResponse> items = sortedVariants.stream().map(v -> VariantResponse.from(v, p.isActive())).toList();
			return from(p, tree, VariantAggregate.of(sortedVariants), items);
		}

		/** List row: figures from the aggregate query, no variants. */
		public static ProductResponse summary(Product p, CategoryTree tree, VariantAggregate agg) {
			return from(p, tree, agg, null);
		}

		private static ProductResponse from(Product p, CategoryTree tree, VariantAggregate agg,
				List<VariantResponse> variants) {
			boolean simple = !p.hasVariants();
			Long categoryId = p.getCategory().getId();
			return new ProductResponse(p.getId(), p.getName(), simple ? agg.sku() : null, p.getUnit(),
					tree.typeOf(categoryId), tree.ref(categoryId), p.getBrand(), p.getModel(), p.getWarrantyMonths(),
					p.getSalePrice(), p.getSalePriceCurrency(), simple ? agg.minStock() : null, p.isActive(),
					p.hasVariants(), (int) agg.variantCount(), StockSummary.from(agg, p.hasVariants()),
					p.isActive() && agg.anyActiveVariantLow(), variants, p.getVersion(), p.getCreatedAt(),
					p.getCreatedBy(), p.getUpdatedAt(), p.getUpdatedBy());
		}

	}

}
