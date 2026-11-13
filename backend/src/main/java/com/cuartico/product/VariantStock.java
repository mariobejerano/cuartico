package com.cuartico.product;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/**
 * Stock and average-cost cache, 1:1 with {@link ProductVariant} (ADR-002 addendum). It is created with
 * zeros and never modified here; from HU-04 only the inventory service writes it.
 */
@Entity
@Table(name = "variant_stock")
public class VariantStock {

	@Id
	private Long variantId;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@MapsId
	@JoinColumn(name = "variant_id")
	private ProductVariant variant;

	@Column(nullable = false, precision = 14, scale = 3)
	private BigDecimal onHand;

	@Column(nullable = false, precision = 14, scale = 3)
	private BigDecimal reserved;

	@Column(precision = 14, scale = 4)
	private BigDecimal averageCost;

	@Column(length = 3)
	private String costCurrency;

	@Column(nullable = false)
	private Instant updatedAt;

	protected VariantStock() {
		// JPA
	}

	VariantStock(ProductVariant variant, Instant now) {
		this.variant = variant;
		this.onHand = BigDecimal.ZERO.setScale(3);
		this.reserved = BigDecimal.ZERO.setScale(3);
		this.updatedAt = now;
	}

	public BigDecimal getOnHand() {
		return onHand;
	}

	public BigDecimal getReserved() {
		return reserved;
	}

	public BigDecimal available() {
		return onHand.subtract(reserved);
	}

	public BigDecimal getAverageCost() {
		return averageCost;
	}

	public String getCostCurrency() {
		return costCurrency;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
