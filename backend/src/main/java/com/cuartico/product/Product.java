package com.cuartico.product;

import java.math.BigDecimal;

import com.cuartico.common.AuditableEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "products")
public class Product extends AuditableEntity {

	private static final int PRICE_SCALE = 2;

	private static final int QUANTITY_SCALE = 3;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(length = 50)
	private String sku;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private UnitOfMeasure unit;

	@Column(length = 50)
	private String category;

	@Column(precision = 12, scale = 2)
	private BigDecimal salePrice;

	@Column(length = 3)
	private String salePriceCurrency;

	@Column(nullable = false, precision = 12, scale = 3)
	private BigDecimal minStock;

	@Column(nullable = false)
	private boolean active = true;

	@Version
	@Column(nullable = false)
	private long version;

	/** Read-only cache of stock and cost (ADR-002); its owner is the inventory module (HU-04). */
	@OneToOne(mappedBy = "product", cascade = CascadeType.PERSIST, fetch = FetchType.EAGER, optional = false)
	private ProductStock stock;

	protected Product() {
		// JPA
	}

	public Product(String name, String sku, UnitOfMeasure unit, String category, BigDecimal salePrice,
			String salePriceCurrency, BigDecimal minStock) {
		update(name, sku, unit, category, salePrice, salePriceCurrency, minStock);
	}

	public void update(String name, String sku, UnitOfMeasure unit, String category, BigDecimal salePrice,
			String salePriceCurrency, BigDecimal minStock) {
		this.name = name;
		this.sku = sku;
		this.unit = unit;
		this.category = category;
		// Fixed scales (Digits validation guarantees no rounding is needed) so JSON is stable
		this.salePrice = salePrice == null ? null : salePrice.setScale(PRICE_SCALE);
		this.salePriceCurrency = salePriceCurrency;
		this.minStock = minStock.setScale(QUANTITY_SCALE);
	}

	void attachStock(ProductStock stock) {
		this.stock = stock;
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

	public String getSku() {
		return sku;
	}

	public UnitOfMeasure getUnit() {
		return unit;
	}

	public String getCategory() {
		return category;
	}

	public BigDecimal getSalePrice() {
		return salePrice;
	}

	public String getSalePriceCurrency() {
		return salePriceCurrency;
	}

	public BigDecimal getMinStock() {
		return minStock;
	}

	public boolean isActive() {
		return active;
	}

	public long getVersion() {
		return version;
	}

	public ProductStock getStock() {
		return stock;
	}

}
