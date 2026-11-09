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
 * Stock and average-cost cache, 1:1 with {@link Product} (ADR-002). In HU-02 it is created with
 * zeros and never modified; from HU-04 only the inventory service writes it.
 */
@Entity
@Table(name = "product_stock")
public class ProductStock {

	@Id
	private Long productId;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@MapsId
	@JoinColumn(name = "product_id")
	private Product product;

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

	protected ProductStock() {
		// JPA
	}

	ProductStock(Product product, Instant now) {
		this.product = product;
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
