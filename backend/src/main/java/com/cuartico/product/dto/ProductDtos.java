package com.cuartico.product.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;

import com.cuartico.category.CategoryTree;
import com.cuartico.category.ProductType;
import com.cuartico.category.dto.CategoryDtos.CategoryRef;
import com.cuartico.common.Normalize;
import com.cuartico.product.Product;
import com.cuartico.product.ProductStock;
import com.cuartico.product.UnitOfMeasure;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** DTOs of the product module. Entities never leave through the API. */
public final class ProductDtos {

	private static final String SKU_REGEX = "^[A-Za-z0-9._-]*$";

	private ProductDtos() {
	}

	/**
	 * Strips and upper-cases a SKU. The upper-casing is applied only to a value that is already valid:
	 * otherwise it could turn an invalid SKU into a valid one (TT-14: "ß".toUpperCase() is "SS", dotless
	 * "ı" becomes "I"). An invalid value is left untouched so the pattern validation answers 400.
	 */
	static String normalizeSku(String sku) {
		String value = Normalize.blankToNull(sku);
		if (value == null || !value.matches(SKU_REGEX)) {
			return value;
		}
		return value.toUpperCase(Locale.ROOT);
	}

	/*
	 * Normalization lives in the compact constructors: Jackson builds the record with the values
	 * already normalized and Bean Validation runs afterwards on them. salePriceCurrency is NOT
	 * normalized on purpose: "usd" must answer product.currency_unsupported.
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
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock) {

		public CreateProductRequest {
			name = name == null ? null : name.strip();
			sku = normalizeSku(sku);
			brand = Normalize.blankToNull(brand);
			model = Normalize.blankToNull(model);
		}

	}

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
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock,
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

		static StockSummary from(ProductStock stock) {
			return new StockSummary(stock.getOnHand(), stock.getReserved(), stock.available(), stock.getAverageCost(),
					stock.getCostCurrency());
		}

	}

	public record ProductResponse(Long id, String name, String sku, UnitOfMeasure unit, ProductType type,
			CategoryRef category, String brand, String model, Integer warrantyMonths, BigDecimal salePrice,
			String salePriceCurrency, BigDecimal minStock, boolean active, StockSummary stock, boolean lowStock,
			long version, Instant createdAt, String createdBy, Instant updatedAt, String updatedBy) {

		public static ProductResponse from(Product p, CategoryTree tree) {
			ProductStock s = p.getStock();
			boolean low = p.isActive() && p.getMinStock().signum() > 0
					&& s.available().compareTo(p.getMinStock()) <= 0;
			Long categoryId = p.getCategory().getId();
			return new ProductResponse(p.getId(), p.getName(), p.getSku(), p.getUnit(), tree.typeOf(categoryId),
					tree.ref(categoryId), p.getBrand(), p.getModel(), p.getWarrantyMonths(), p.getSalePrice(),
					p.getSalePriceCurrency(), p.getMinStock(), p.isActive(), StockSummary.from(s), low, p.getVersion(),
					p.getCreatedAt(), p.getCreatedBy(), p.getUpdatedAt(), p.getUpdatedBy());
		}

	}

}
