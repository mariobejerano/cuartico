package com.cuartico.product;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.cuartico.category.Category;
import com.cuartico.category.CategoryRepository;
import com.cuartico.category.CategoryService;
import com.cuartico.category.CategoryTree;
import com.cuartico.category.ProductType;
import com.cuartico.common.ApiException;
import com.cuartico.common.dto.PageResponse;
import com.cuartico.config.AppProperties;
import com.cuartico.product.dto.ProductDtos.CreateProductRequest;
import com.cuartico.product.dto.ProductDtos.ProductQuery;
import com.cuartico.product.dto.ProductDtos.ProductResponse;
import com.cuartico.product.dto.ProductDtos.UpdateProductRequest;

import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Transactional(readOnly = true)
public class ProductService {

	private static final String SKU_CONSTRAINT = "uk_products_sku";

	/** Attempts of an activate/deactivate that loses the optimistic-lock race (see {@link #setActive}). */
	private static final int TOGGLE_ATTEMPTS = 3;

	/** API sort field to entity property. Anything else answers request.invalid_sort. */
	private static final Map<String, String> SORT_FIELDS = Map.of("name", "name", "sku", "sku", "createdAt",
			"createdAt");

	private final ProductRepository products;

	private final CategoryRepository categoryRepository;

	private final CategoryService categoryService;

	private final AppProperties props;

	private final Clock clock;

	private final TransactionTemplate tx;

	public ProductService(ProductRepository products, CategoryRepository categoryRepository,
			CategoryService categoryService, AppProperties props, Clock clock, PlatformTransactionManager txManager) {
		this.products = products;
		this.categoryRepository = categoryRepository;
		this.categoryService = categoryService;
		this.props = props;
		this.clock = clock;
		this.tx = new TransactionTemplate(txManager);
	}

	public PageResponse<ProductResponse> search(ProductQuery query) {
		PageRequest pageable = PageRequest.of(query.pageOrDefault(), query.sizeOrDefault(),
				parseSort(query.sortOrDefault()));
		CategoryTree tree = categoryService.tree();
		// Filtering by a category includes its descendants (ids computed in memory)
		Set<Long> categoryIds = query.categoryId() == null ? null : tree.descendantIds(query.categoryId());
		return PageResponse
			.from(products.findAll(toSpecification(query, categoryIds), pageable).map(p -> ProductResponse.from(p, tree)));
	}

	public ProductResponse findById(Long id) {
		return ProductResponse.from(get(id), categoryService.tree());
	}

	@Transactional
	public ProductResponse create(CreateProductRequest req) {
		validateCurrency(req.salePrice() != null, req.salePriceCurrency());
		Category category = resolveCategory(req.categoryId(), null);
		validateTypeRules(category.getProductType(), req.unit(), req.model(), req.warrantyMonths());
		if (req.sku() != null && products.existsBySku(req.sku())) {
			throw ApiException.conflict("product.sku_conflict", req.sku());
		}
		Product product = new Product(req.name(), req.sku(), req.unit(), category, req.brand(), req.model(),
				req.warrantyMonths(), req.salePrice(), req.salePriceCurrency(), req.minStock());
		// The stock row is created with zeros in the same transaction (ADR-002)
		product.attachStock(new ProductStock(product, clock.instant()));
		return respond(saveAndFlush(product));
	}

	/*
	 * Concurrency: optimistic locking (@Version). Editing a catalog record is a long human
	 * operation (open form, edit, save) where conflicts are rare and the right answer is to tell
	 * the second editor, not to make them wait. The client sends the version it edited; a
	 * mismatch answers 409, and the residual race at flush is translated by the global handler.
	 */
	@Transactional
	public ProductResponse update(Long id, UpdateProductRequest req) {
		Product product = get(id);
		if (req.version() != product.getVersion()) {
			throw ApiException.conflict("resource.version_conflict");
		}
		validateCurrency(req.salePrice() != null, req.salePriceCurrency());
		Category category = resolveCategory(req.categoryId(), product.getCategory().getId());
		// The server never clears attributes by itself: moving to another type must send them empty (ADR-003)
		validateTypeRules(category.getProductType(), req.unit(), req.model(), req.warrantyMonths());
		if (req.sku() != null && products.existsBySkuAndIdNot(req.sku(), id)) {
			throw ApiException.conflict("product.sku_conflict", req.sku());
		}
		product.update(req.name(), req.sku(), req.unit(), category, req.brand(), req.model(), req.warrantyMonths(),
				req.salePrice(), req.salePriceCurrency(), req.minStock());
		return respond(saveAndFlush(product));
	}

	/*
	 * Activate/deactivate are idempotent also under a race (TT-14): two simultaneous deactivations of
	 * the same product must both answer 200. The loser of the optimistic-lock race rolls back and
	 * retries in a new transaction, where it reads the state the winner left and returns it unchanged.
	 * That is why this method runs outside a transaction and each attempt gets its own.
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public ProductResponse setActive(Long id, boolean active) {
		for (int attempt = 1;; attempt++) {
			try {
				return tx.execute(status -> toggle(id, active));
			}
			catch (ObjectOptimisticLockingFailureException ex) {
				if (attempt >= TOGGLE_ATTEMPTS) {
					throw ex;
				}
			}
		}
	}

	private ProductResponse toggle(Long id, boolean active) {
		Product product = get(id);
		if (product.isActive() == active) {
			return respond(product);
		}
		product.setActive(active);
		return respond(saveAndFlush(product));
	}

	private Product get(Long id) {
		return products.findById(id).orElseThrow(() -> ApiException.notFound("product.not_found", String.valueOf(id)));
	}

	private ProductResponse respond(Product product) {
		return ProductResponse.from(product, categoryService.tree());
	}

	/**
	 * Loads the category of the request. Inexistent: 400 (not 404, the URL resource does exist).
	 * Inactive: 400, unless the product already has that very category (current), which keeps
	 * products editable after their category was deactivated.
	 */
	private Category resolveCategory(Long categoryId, Long currentCategoryId) {
		Category category = categoryRepository.findById(categoryId)
			.orElseThrow(() -> ApiException.badRequest("product.category_not_found", String.valueOf(categoryId)));
		if (!category.isActive() && !category.getId().equals(currentCategoryId)) {
			throw ApiException.badRequest("category.inactive");
		}
		return category;
	}

	/** Attributes and unit allowed by the product type (CA-16, CA-17). */
	private void validateTypeRules(ProductType type, UnitOfMeasure unit, String model, Integer warrantyMonths) {
		if (!type.allowsModelAndWarranty()) {
			if (model != null) {
				throw ApiException.badRequest("product.attribute_not_allowed", "model");
			}
			if (warrantyMonths != null) {
				throw ApiException.badRequest("product.attribute_not_allowed", "warrantyMonths");
			}
		}
		if (type.requiresUnitOnly() && unit != UnitOfMeasure.UNIT) {
			throw ApiException.badRequest("product.unit_not_allowed");
		}
	}

	private void validateCurrency(boolean hasPrice, String currency) {
		if (hasPrice != (currency != null)) {
			throw ApiException.badRequest("product.price_currency_mismatch");
		}
		// Exact comparison: "usd" is not "USD"
		if (currency != null && !props.currencies().supported().contains(currency)) {
			throw ApiException.badRequest("product.currency_unsupported", currency);
		}
	}

	/** The unique constraint is the final guarantee for duplicate SKUs (two simultaneous requests). */
	private Product saveAndFlush(Product product) {
		try {
			return products.saveAndFlush(product);
		}
		catch (DataIntegrityViolationException ex) {
			if (violatesSkuConstraint(ex)) {
				throw ApiException.conflict("product.sku_conflict", product.getSku());
			}
			throw ex;
		}
	}

	private static boolean violatesSkuConstraint(Throwable ex) {
		// PostgreSQL reports uk_products_sku, H2 UK_PRODUCTS_SKU: compare ignoring case
		for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
			String message = t.getMessage();
			if (message != null && message.toLowerCase(Locale.ROOT).contains(SKU_CONSTRAINT)) {
				return true;
			}
		}
		return false;
	}

	private static Sort parseSort(String sort) {
		String[] parts = sort.split(",", -1);
		String property = parts.length >= 1 ? SORT_FIELDS.get(parts[0].strip()) : null;
		boolean validDirection = parts.length == 1
				|| (parts.length == 2 && (parts[1].strip().equalsIgnoreCase("asc") || parts[1].strip().equalsIgnoreCase("desc")));
		if (property == null || !validDirection) {
			throw ApiException.badRequest("request.invalid_sort", sort);
		}
		Sort.Direction direction = parts.length == 2 && parts[1].strip().equalsIgnoreCase("desc") ? Sort.Direction.DESC
				: Sort.Direction.ASC;
		Sort.Order order = new Sort.Order(direction, property);
		if (!property.equals("createdAt")) {
			order = order.ignoreCase();
		}
		// Stable order: tie-break by id
		return Sort.by(order, Sort.Order.asc("id"));
	}

	private static Specification<Product> toSpecification(ProductQuery query, Set<Long> categoryIds) {
		return (root, cq, cb) -> {
			// The count query has no fetch: only the content query joins the stock row (one query, no N+1).
			// The category is not fetched: the response only needs its id, and the tree is in memory.
			if (cq != null && !Long.class.equals(cq.getResultType())) {
				root.fetch("stock", JoinType.INNER);
			}
			List<Predicate> predicates = new ArrayList<>();
			if (query.q() != null) {
				String pattern = "%" + escapeLike(query.q().toLowerCase(Locale.ROOT)) + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'),
						cb.like(cb.lower(root.get("sku")), pattern, '\\')));
			}
			if (query.active() != null) {
				predicates.add(cb.equal(root.get("active"), query.active()));
			}
			if (categoryIds != null) {
				// An unknown category matches nothing (an empty IN list is not valid SQL)
				predicates.add(categoryIds.isEmpty() ? cb.disjunction() : root.get("category").get("id").in(categoryIds));
			}
			if (query.type() != null) {
				predicates.add(cb.equal(root.get("category").get("productType"), query.type()));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static String escapeLike(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
