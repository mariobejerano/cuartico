package com.cuartico.product;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

import com.cuartico.common.AuditableEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.annotations.ColumnTransformer;

/**
 * What is bought, stored and sold (ADR-003): SKU, size, color, low-stock threshold and the stock row. A simple
 * product has exactly one, without size or color. It carries its own {@code @Version}: variant operations never
 * touch the version of the product (HU-16 CA-13b).
 */
@Entity
@Table(name = "product_variants")
public class ProductVariant extends AuditableEntity {

	private static final int QUANTITY_SCALE = 3;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "product_id", nullable = false)
	private Product product;

	@Column(length = 50)
	private String sku;

	/** Upper-cased and trimmed by the DTO; null when the variant has no size. */
	@Column(length = 20)
	private String size;

	@Column(length = 30)
	private String color;

	/**
	 * Uniqueness key of the color. The service assigns the color and the DATABASE normalizes it on write with
	 * LOWER(TRIM(?)), the function the V5 constraint is defined on: no second normalization in Java.
	 */
	@ColumnTransformer(write = "lower(trim(?))")
	@Column(name = "color_key", length = 30)
	private String colorKey;

	@Column(nullable = false, precision = 12, scale = 3)
	private BigDecimal minStock;

	@Column(nullable = false)
	private boolean active = true;

	@Version
	@Column(nullable = false)
	private long version;

	/** Read-only cache of stock and cost (ADR-002); its owner is the inventory module (HU-04). */
	@OneToOne(mappedBy = "variant", cascade = CascadeType.PERSIST, fetch = FetchType.EAGER, optional = false)
	private VariantStock stock;

	protected ProductVariant() {
		// JPA
	}

	ProductVariant(Product product, String sku, String size, String color, BigDecimal minStock, Instant now) {
		this.product = product;
		update(sku, size, color, minStock);
		// The stock row is created with zeros in the same transaction (ADR-002)
		this.stock = new VariantStock(this, now);
	}

	/** Returns true when some value actually changed. */
	boolean update(String sku, String size, String color, BigDecimal minStock) {
		BigDecimal scaled = minStock.setScale(QUANTITY_SCALE);
		boolean changed = !Objects.equals(this.sku, sku) || !Objects.equals(this.size, size)
				|| !Objects.equals(this.color, color) || this.minStock == null || this.minStock.compareTo(scaled) != 0;
		this.sku = sku;
		setOptions(size, color);
		this.minStock = scaled;
		return changed;
	}

	void setOptions(String size, String color) {
		this.size = size;
		// The key is only rewritten when the color changes: an unchanged variant stays clean (no needless version bump)
		if (!Objects.equals(color, this.color)) {
			this.colorKey = color;
		}
		this.color = color;
	}

	void setActive(boolean active) {
		this.active = active;
	}

	public Long getId() {
		return id;
	}

	public Product getProduct() {
		return product;
	}

	public String getSku() {
		return sku;
	}

	public String getSize() {
		return size;
	}

	public String getColor() {
		return color;
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

	public VariantStock getStock() {
		return stock;
	}

	/** Low-stock alert of this variant alone: active, with a threshold, and available at or below it. */
	public boolean isLowStock() {
		return active && minStock.signum() > 0 && stock.available().compareTo(minStock) <= 0;
	}

}
