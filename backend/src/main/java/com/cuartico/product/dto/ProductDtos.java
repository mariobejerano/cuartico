package com.cuartico.product.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;

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

	static String normalizeSku(String sku) {
		String value = Normalize.blankToNull(sku);
		return value == null ? null : value.toUpperCase(Locale.ROOT);
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
			@Size(max = 50) String category,
			@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal salePrice,
			String salePriceCurrency,
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock) {

		public CreateProductRequest {
			name = name == null ? null : name.strip();
			sku = normalizeSku(sku);
			category = Normalize.blankToNull(category);
		}

	}

	public record UpdateProductRequest(
			@NotBlank @Size(max = 120) String name,
			@Size(max = 50) @Pattern(regexp = SKU_REGEX, message = "{product.sku.pattern}") String sku,
			@NotNull UnitOfMeasure unit,
			@Size(max = 50) String category,
			@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal salePrice,
			String salePriceCurrency,
			@NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 3) BigDecimal minStock,
			@NotNull Long version) {

		public UpdateProductRequest {
			name = name == null ? null : name.strip();
			sku = normalizeSku(sku);
			category = Normalize.blankToNull(category);
		}

	}

	/** List parameters; a record with @ModelAttribute instead of Pageable so size is never clamped silently. */
	public record ProductQuery(
			@Size(max = 100) String q,
			Boolean active,
			@Size(max = 50) String category,
			@Min(0) Integer page,
			@Min(1) @Max(100) Integer size,
			String sort) {

		public static final int DEFAULT_SIZE = 20;

		public ProductQuery {
			q = Normalize.blankToNull(q);
			category = Normalize.blankToNull(category);
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

	public record ProductResponse(Long id, String name, String sku, UnitOfMeasure unit, String category,
			BigDecimal salePrice, String salePriceCurrency, BigDecimal minStock, boolean active, StockSummary stock,
			boolean lowStock, long version, Instant createdAt, String createdBy, Instant updatedAt,
			String updatedBy) {

		public static ProductResponse from(Product p) {
			ProductStock s = p.getStock();
			boolean low = p.isActive() && p.getMinStock().signum() > 0
					&& s.available().compareTo(p.getMinStock()) <= 0;
			return new ProductResponse(p.getId(), p.getName(), p.getSku(), p.getUnit(), p.getCategory(),
					p.getSalePrice(), p.getSalePriceCurrency(), p.getMinStock(), p.isActive(), StockSummary.from(s),
					low, p.getVersion(), p.getCreatedAt(), p.getCreatedBy(), p.getUpdatedAt(), p.getUpdatedBy());
		}

	}

}
