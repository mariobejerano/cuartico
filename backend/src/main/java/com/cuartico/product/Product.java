package com.cuartico.product;

import java.math.BigDecimal;
import java.util.Objects;

import com.cuartico.category.Category;
import com.cuartico.common.AuditableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Catalog product. SKU, low-stock threshold and stock live in its variants (ADR-003, HU-16). There is no
 * collection of variants here on purpose: variants are always read and written through
 * {@link ProductVariantRepository}, so no variant operation can bump this entity's version by accident (CA-13b).
 */
@Entity
@Table(name = "products")
public class Product extends AuditableEntity {

	private static final int PRICE_SCALE = 2;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private UnitOfMeasure unit;

	/** The product type is the one of its category (ADR-003): it is derived, not stored here. */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "category_id", nullable = false)
	private Category category;

	@Column(length = 80)
	private String brand;

	/** Appliances only (validated by the service). */
	@Column(length = 80)
	private String model;

	/** Appliances only; informative. */
	private Integer warrantyMonths;

	@Column(precision = 12, scale = 2)
	private BigDecimal salePrice;

	@Column(length = 3)
	private String salePriceCurrency;

	/**
	 * false: exactly one hidden variant holds SKU, threshold and stock; true: one or more variants with size and/or
	 * color. Changing it bumps the version of the product (it changes what the product form accepts).
	 */
	@Column(nullable = false)
	private boolean hasVariants;

	@Column(nullable = false)
	private boolean active = true;

	@Version
	@Column(nullable = false)
	private long version;

	protected Product() {
		// JPA
	}

	public Product(String name, UnitOfMeasure unit, Category category, String brand, String model,
			Integer warrantyMonths, BigDecimal salePrice, String salePriceCurrency, boolean hasVariants) {
		update(name, unit, category, brand, model, warrantyMonths, salePrice, salePriceCurrency);
		this.hasVariants = hasVariants;
	}

	/** Returns true when some value actually changed (so the caller knows whether the row will be written). */
	public boolean update(String name, UnitOfMeasure unit, Category category, String brand, String model,
			Integer warrantyMonths, BigDecimal salePrice, String salePriceCurrency) {
		// Fixed scales (Digits validation guarantees no rounding is needed) so JSON is stable
		BigDecimal scaledPrice = salePrice == null ? null : salePrice.setScale(PRICE_SCALE);
		boolean changed = !Objects.equals(this.name, name) || this.unit != unit
				|| this.category == null || !Objects.equals(this.category.getId(), category.getId())
				|| !Objects.equals(this.brand, brand) || !Objects.equals(this.model, model)
				|| !Objects.equals(this.warrantyMonths, warrantyMonths)
				|| (this.salePrice == null ? scaledPrice != null : scaledPrice == null || this.salePrice.compareTo(scaledPrice) != 0)
				|| !Objects.equals(this.salePriceCurrency, salePriceCurrency);
		this.name = name;
		this.unit = unit;
		this.category = category;
		this.brand = brand;
		this.model = model;
		this.warrantyMonths = warrantyMonths;
		this.salePrice = scaledPrice;
		this.salePriceCurrency = salePriceCurrency;
		return changed;
	}

	void setHasVariants(boolean hasVariants) {
		this.hasVariants = hasVariants;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public Long getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public UnitOfMeasure getUnit() {
		return unit;
	}

	public Category getCategory() {
		return category;
	}

	public String getBrand() {
		return brand;
	}

	public String getModel() {
		return model;
	}

	public Integer getWarrantyMonths() {
		return warrantyMonths;
	}

	public BigDecimal getSalePrice() {
		return salePrice;
	}

	public String getSalePriceCurrency() {
		return salePriceCurrency;
	}

	public boolean hasVariants() {
		return hasVariants;
	}

	public boolean isActive() {
		return active;
	}

	public long getVersion() {
		return version;
	}

}
