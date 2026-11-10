package com.cuartico.category;

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

import org.hibernate.annotations.ColumnTransformer;

/** Node of the category tree (adjacency list, at most 3 levels). It is never deleted, only deactivated. */
@Entity
@Table(name = "categories")
public class Category extends AuditableEntity {

	public static final int MAX_DEPTH = 3;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private Category parent;

	@Column(nullable = false, length = 60)
	private String name;

	@Column(length = 60)
	private String nameEn;

	/**
	 * Uniqueness key. The service assigns the name and the DATABASE normalizes it on write, with the
	 * same function the V4 migration used: no second normalization in Java (ADR-003).
	 */
	@ColumnTransformer(write = "lower(trim(?))")
	@Column(name = "name_key", nullable = false, length = 60)
	private String nameKey;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ProductType productType;

	@Column(nullable = false)
	private Integer depth;

	@Column(nullable = false)
	private boolean active = true;

	@Version
	@Column(nullable = false)
	private long version;

	protected Category() {
		// JPA
	}

	/** Root: depth 1 and the declared type. */
	public static Category root(String name, String nameEn, ProductType type) {
		Category c = new Category();
		c.rename(name, nameEn);
		c.productType = type;
		c.depth = 1;
		return c;
	}

	/** Child: depth parent + 1 and the type of the parent (immutable). */
	public static Category child(Category parent, String name, String nameEn) {
		Category c = new Category();
		c.rename(name, nameEn);
		c.parent = parent;
		c.productType = parent.productType;
		c.depth = parent.depth + 1;
		return c;
	}

	public void rename(String name, String nameEn) {
		if (!name.equals(this.name)) {
			this.nameKey = name;
		}
		this.name = name;
		this.nameEn = nameEn;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public Long getId() {
		return id;
	}

	public Category getParent() {
		return parent;
	}

	public String getName() {
		return name;
	}

	public String getNameEn() {
		return nameEn;
	}

	public ProductType getProductType() {
		return productType;
	}

	public int getDepth() {
		return depth;
	}

	public boolean isActive() {
		return active;
	}

	public long getVersion() {
		return version;
	}

}
