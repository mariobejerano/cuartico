package com.cuartico.category.dto;

import java.time.Instant;

import com.cuartico.category.ProductType;
import com.cuartico.common.Normalize;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** DTOs of the category module. Entities never leave through the API. */
public final class CategoryDtos {

	private CategoryDtos() {
	}

	/** {@code productType} is required for a root and forbidden for a child (it is inherited). */
	public record CreateCategoryRequest(
			@NotBlank @Size(max = 60) String name,
			@Size(max = 60) String nameEn,
			Long parentId,
			ProductType productType) {

		public CreateCategoryRequest {
			name = name == null ? null : name.strip();
			nameEn = Normalize.blankToNull(nameEn);
		}

	}

	/** Parent and type cannot change: they are not part of this DTO. */
	public record UpdateCategoryRequest(
			@NotBlank @Size(max = 60) String name,
			@Size(max = 60) String nameEn,
			@NotNull Long version) {

		public UpdateCategoryRequest {
			name = name == null ? null : name.strip();
			nameEn = Normalize.blankToNull(nameEn);
		}

	}

	public record CategoryResponse(Long id, Long parentId, String name, String nameEn, ProductType productType,
			int depth, boolean active, String path, String pathEn, long productCount, long version,
			Instant createdAt, String createdBy, Instant updatedAt, String updatedBy) {
	}

	/** Compact category reference embedded in product responses. */
	public record CategoryRef(Long id, String name, String nameEn, String path, String pathEn, boolean active) {
	}

}
