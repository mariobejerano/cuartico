package com.cuartico.category;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.cuartico.category.dto.CategoryDtos.CategoryResponse;
import com.cuartico.category.dto.CategoryDtos.CreateCategoryRequest;
import com.cuartico.category.dto.CategoryDtos.UpdateCategoryRequest;
import com.cuartico.common.ApiException;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Category management (HU-15). Concurrency: rename uses optimistic locking (@Version) like products;
 * the structural operations (create child, deactivate, activate) take a PESSIMISTIC_WRITE lock on the
 * parent / target row. They are rare and fast, and the lock closes the race "someone creates an active
 * child while someone else deactivates its parent" that no unique constraint can express.
 */
@Service
@Transactional(readOnly = true)
public class CategoryService {

	private static final String NAME_CONSTRAINT = "uk_categories_parent_name";

	/** Id that matches no row: "exclude nothing" in the duplicate-name queries. */
	private static final long NO_ID = -1L;

	private final CategoryRepository categories;

	public CategoryService(CategoryRepository categories) {
		this.categories = categories;
	}

	/** Snapshot of the whole tree, for paths and descendants (used by the product module too). */
	public CategoryTree tree() {
		return new CategoryTree(categories.findAll());
	}

	public List<CategoryResponse> list(Boolean active) {
		CategoryTree tree = tree();
		Map<Long, Long> counts = productCounts();
		return categories.findAll()
			.stream()
			.filter(c -> active == null || c.isActive() == active)
			.sorted((a, b) -> tree.pathOrder().compare(a.getId(), b.getId()))
			.map(c -> toResponse(c, tree, counts))
			.toList();
	}

	public CategoryResponse findById(Long id) {
		Category category = get(id);
		return toResponse(category, tree(), productCounts());
	}

	@Transactional
	public CategoryResponse create(CreateCategoryRequest req) {
		Category category;
		if (req.parentId() == null) {
			if (req.productType() == null) {
				throw ApiException.badRequest("category.type_required");
			}
			assertNameFree(null, req.name(), NO_ID);
			category = Category.root(req.name(), req.nameEn(), req.productType());
		}
		else {
			if (req.productType() != null) {
				throw ApiException.badRequest("category.type_inherited");
			}
			Category parent = categories.findByIdForUpdate(req.parentId())
				.orElseThrow(() -> ApiException.notFound("category.not_found", String.valueOf(req.parentId())));
			if (parent.getDepth() >= Category.MAX_DEPTH) {
				throw ApiException.badRequest("category.max_depth");
			}
			if (!parent.isActive()) {
				throw ApiException.conflict("category.parent_inactive");
			}
			assertNameFree(parent.getId(), req.name(), NO_ID);
			category = Category.child(parent, req.name(), req.nameEn());
		}
		return respond(saveAndFlush(category));
	}

	@Transactional
	public CategoryResponse update(Long id, UpdateCategoryRequest req) {
		Category category = get(id);
		if (req.version() != category.getVersion()) {
			throw ApiException.conflict("resource.version_conflict");
		}
		Long parentId = category.getParent() == null ? null : category.getParent().getId();
		assertNameFree(parentId, req.name(), id);
		category.rename(req.name(), req.nameEn());
		return respond(saveAndFlush(category));
	}

	/** Idempotent: 200 with no new version when the category is already in that state. */
	@Transactional
	public CategoryResponse setActive(Long id, boolean active) {
		Category category;
		if (active) {
			// Lock order is always parent before child, so activate and deactivate cannot deadlock
			Long parentId = categories.findParentId(id).orElse(null);
			Category parent = parentId == null ? null : categories.findByIdForUpdate(parentId).orElse(null);
			category = categories.findByIdForUpdate(id)
				.orElseThrow(() -> ApiException.notFound("category.not_found", String.valueOf(id)));
			if (category.isActive()) {
				return respond(category);
			}
			if (parent != null && !parent.isActive()) {
				throw ApiException.conflict("category.parent_inactive");
			}
		}
		else {
			category = categories.findByIdForUpdate(id)
				.orElseThrow(() -> ApiException.notFound("category.not_found", String.valueOf(id)));
			if (!category.isActive()) {
				return respond(category);
			}
			if (categories.hasActiveChildren(id)) {
				throw ApiException.conflict("category.has_active_children");
			}
		}
		category.setActive(active);
		return respond(saveAndFlush(category));
	}

	private Category get(Long id) {
		return categories.findById(id)
			.orElseThrow(() -> ApiException.notFound("category.not_found", String.valueOf(id)));
	}

	/** Friendly 409 before inserting; the unique constraint remains the final guarantee. */
	private void assertNameFree(Long parentId, String name, Long excludeId) {
		boolean taken = parentId == null ? categories.existsRootByName(name, excludeId)
				: categories.existsChildByName(parentId, name, excludeId);
		if (taken) {
			throw ApiException.conflict("category.name_conflict", name);
		}
	}

	private Category saveAndFlush(Category category) {
		try {
			return categories.saveAndFlush(category);
		}
		catch (DataIntegrityViolationException ex) {
			if (violatesNameConstraint(ex)) {
				throw ApiException.conflict("category.name_conflict", category.getName());
			}
			throw ex;
		}
	}

	private static boolean violatesNameConstraint(Throwable ex) {
		// PostgreSQL reports uk_categories_parent_name, H2 UK_CATEGORIES_PARENT_NAME: compare ignoring case
		for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
			String message = t.getMessage();
			if (message != null && message.toLowerCase(Locale.ROOT).contains(NAME_CONSTRAINT)) {
				return true;
			}
		}
		return false;
	}

	private CategoryResponse respond(Category category) {
		return toResponse(category, tree(), productCounts());
	}

	private Map<Long, Long> productCounts() {
		Map<Long, Long> counts = new HashMap<>();
		for (Object[] row : categories.countProductsByCategory()) {
			counts.put((Long) row[0], (Long) row[1]);
		}
		return counts;
	}

	private static CategoryResponse toResponse(Category c, CategoryTree tree, Map<Long, Long> counts) {
		return new CategoryResponse(c.getId(), c.getParent() == null ? null : c.getParent().getId(), c.getName(),
				c.getNameEn(), c.getProductType(), c.getDepth(), c.isActive(), tree.path(c.getId()),
				tree.pathEn(c.getId()), counts.getOrDefault(c.getId(), 0L), c.getVersion(), c.getCreatedAt(),
				c.getCreatedBy(), c.getUpdatedAt(), c.getUpdatedBy());
	}

}
