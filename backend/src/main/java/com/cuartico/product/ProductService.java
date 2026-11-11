package com.cuartico.product;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
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
import com.cuartico.common.FieldValidationException;
import com.cuartico.common.dto.PageResponse;
import com.cuartico.config.AppProperties;
import com.cuartico.product.dto.ProductDtos.AddVariantsRequest;
import com.cuartico.product.dto.ProductDtos.CreateProductRequest;
import com.cuartico.product.dto.ProductDtos.EnableVariantsRequest;
import com.cuartico.product.dto.ProductDtos.ProductQuery;
import com.cuartico.product.dto.ProductDtos.ProductResponse;
import com.cuartico.product.dto.ProductDtos.UpdateProductRequest;
import com.cuartico.product.dto.ProductDtos.UpdateVariantRequest;
import com.cuartico.product.dto.ProductDtos.VariantRequest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Product catalog and its variants (HU-02, HU-16).
 *
 * <p>Concurrency, in two layers (ADR-003):
 * <ul>
 * <li>The product record keeps optimistic locking ({@code @Version}): editing a catalog form is a long human
 * operation where conflicts are rare and the right answer is to tell the second editor.</li>
 * <li>Everything that decides on the SET of variants of one product (add, edit, activate/deactivate a variant,
 * convert simple/with variants, and the product PUT itself, which also rewrites the hidden variant of a simple
 * product) first takes a {@code PESSIMISTIC_WRITE} lock on the product row, without incrementing its version. They
 * are rare and short, and the lock closes races no constraint can express: "disable" crossing "add variant"
 * (a simple product with two variants), or two requests creating the same options (the unique constraint stays
 * the last guarantee, never a 500). The lock order is always product first, then variants, so there are no
 * cycles. The version of the product does not move with variant operations (CA-13b): each variant protects its
 * own fields with its own {@code @Version}.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class ProductService {

	private static final String SKU_CONSTRAINT = "uk_product_variants_sku";

	private static final String OPTIONS_CONSTRAINT = "uk_product_variants_options";

	private static final String NOT_NULL_MESSAGE = "jakarta.validation.constraints.NotNull.message";

	private static final String NOT_EMPTY_MESSAGE = "jakarta.validation.constraints.NotEmpty.message";

	/** Attempts of an activate/deactivate that loses the optimistic-lock race (see {@link #setActive}). */
	private static final int TOGGLE_ATTEMPTS = 3;

	/** API sort field to entity property. Anything else answers request.invalid_sort ("sku" is retired: HU-16 CA-17). */
	private static final Map<String, String> SORT_FIELDS = Map.of("name", "name", "createdAt", "createdAt");

	private final ProductRepository products;

	private final ProductVariantRepository variants;

	private final CategoryRepository categoryRepository;

	private final CategoryService categoryService;

	private final AppProperties props;

	private final Clock clock;

	private final TransactionTemplate tx;

	private final EntityManager entityManager;

	public ProductService(ProductRepository products, ProductVariantRepository variants,
			CategoryRepository categoryRepository, CategoryService categoryService, AppProperties props, Clock clock,
			PlatformTransactionManager txManager, EntityManager entityManager) {
		this.products = products;
		this.variants = variants;
		this.categoryRepository = categoryRepository;
		this.categoryService = categoryService;
		this.props = props;
		this.clock = clock;
		this.tx = new TransactionTemplate(txManager);
		this.entityManager = entityManager;
	}

	/** A variant to be written, already normalized by the DTO. */
	private record VariantData(String sku, String size, String color, BigDecimal minStock) {

		static VariantData of(VariantRequest r) {
			return new VariantData(r.sku(), r.size(), r.color(), r.minStock());
		}

		boolean hasOptions() {
			return size != null || color != null;
		}

		OptionKey key() {
			return OptionKey.of(size, color);
		}

		String label() {
			return optionsLabel(size, color);
		}

	}

	/** Size and color without distinguishing case, the Java twin of the (product_id, size, color_key) constraint. */
	private record OptionKey(String size, String colorKey) {

		static OptionKey of(String size, String color) {
			return new OptionKey(size, color == null ? null : color.strip().toLowerCase(Locale.ROOT));
		}

	}

	// ---------------------------------------------------------------- reads

	public PageResponse<ProductResponse> search(ProductQuery query) {
		PageRequest pageable = PageRequest.of(query.pageOrDefault(), query.sizeOrDefault(),
				parseSort(query.sortOrDefault()));
		CategoryTree tree = categoryService.tree();
		// Filtering by a category includes its descendants (ids computed in memory)
		Set<Long> categoryIds = query.categoryId() == null ? null : tree.descendantIds(query.categoryId());
		Page<Product> page = products.findAll(toSpecification(query, categoryIds), pageable);
		// One GROUP BY for the whole page: the list never loads variants row by row (CA-15)
		Map<Long, VariantAggregate> aggregates = new HashMap<>();
		if (!page.isEmpty()) {
			List<Long> ids = page.getContent().stream().map(Product::getId).toList();
			for (Object[] row : variants.aggregateByProductIds(ids)) {
				aggregates.put((Long) row[0], VariantAggregate.fromRow(row));
			}
		}
		return PageResponse.from(page.map(
				p -> ProductResponse.summary(p, tree, aggregates.getOrDefault(p.getId(), VariantAggregate.empty()))));
	}

	public ProductResponse findById(Long id) {
		return respond(get(id));
	}

	// ---------------------------------------------------------------- product

	@Transactional
	public ProductResponse create(CreateProductRequest req) {
		// Structural rules first: cheap, and independent of the database
		List<VariantData> items;
		if (req.withVariants()) {
			if (req.sku() != null || req.minStock() != null) {
				throw ApiException.badRequest("product.variant_fields_not_allowed");
			}
			if (req.variants() == null || req.variants().isEmpty()) {
				throw new FieldValidationException("variants", NOT_EMPTY_MESSAGE);
			}
			items = req.variants().stream().map(VariantData::of).toList();
		}
		else {
			if (req.variants() != null && !req.variants().isEmpty()) {
				throw ApiException.badRequest("product.variant_fields_not_allowed");
			}
			if (req.minStock() == null) {
				throw new FieldValidationException("minStock", NOT_NULL_MESSAGE);
			}
			// The simple product keeps one hidden variant with no size or color (ADR-003)
			items = List.of(new VariantData(req.sku(), null, null, req.minStock()));
		}
		validateCurrency(req.salePrice() != null, req.salePriceCurrency());
		Category category = resolveCategory(req.categoryId(), null);
		validateTypeRules(category.getProductType(), req.unit(), req.model(), req.warrantyMonths());
		validateNewVariants(items, List.of(), req.withVariants());

		Product product = products.saveAndFlush(new Product(req.name(), req.unit(), category, req.brand(), req.model(),
				req.warrantyMonths(), req.salePrice(), req.salePriceCurrency(), req.withVariants()));
		for (VariantData item : items) {
			saveNew(product, item);
		}
		return respond(product);
	}

	/*
	 * The version is checked under the row lock, so the comparison is exact against variant conversions and
	 * variant operations that run at the same time. A PUT that changes only the hidden variant of a simple product
	 * (SKU, threshold) would not dirty the product row and so would never reach the optimistic check: the lock
	 * covers that case too.
	 */
	@Transactional
	public ProductResponse update(Long id, UpdateProductRequest req) {
		Product product = lock(id);
		if (req.version() != product.getVersion()) {
			throw ApiException.conflict("resource.version_conflict");
		}
		validateCurrency(req.salePrice() != null, req.salePriceCurrency());
		Category category = resolveCategory(req.categoryId(), product.getCategory().getId());
		// The server never clears attributes by itself: moving to another type must send them empty (ADR-003)
		validateTypeRules(category.getProductType(), req.unit(), req.model(), req.warrantyMonths());

		ProductVariant hidden = null;
		if (product.hasVariants()) {
			if (req.sku() != null || req.minStock() != null) {
				throw ApiException.badRequest("product.variant_fields_not_allowed");
			}
		}
		else {
			if (req.minStock() == null) {
				throw new FieldValidationException("minStock", NOT_NULL_MESSAGE);
			}
			hidden = onlyVariant(product.getId());
			if (req.sku() != null && variants.existsBySkuAndIdNot(req.sku(), hidden.getId())) {
				throw ApiException.conflict("product.sku_conflict", req.sku());
			}
		}
		boolean productChanged = product.update(req.name(), req.unit(), category, req.brand(), req.model(),
				req.warrantyMonths(), req.salePrice(), req.salePriceCurrency());
		products.saveAndFlush(product);
		if (hidden != null) {
			boolean hiddenChanged = hidden.update(req.sku(), null, null, req.minStock());
			flush(hidden, new VariantData(req.sku(), null, null, req.minStock()));
			if (hiddenChanged && !productChanged) {
				// For a simple product the version that rules is the product one (CA-13b): a change that touches only
				// its hidden variant must still invalidate every other open form, so the version is bumped now.
				entityManager.lock(product, LockModeType.PESSIMISTIC_FORCE_INCREMENT);
			}
		}
		return respond(product);
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
		return respond(products.saveAndFlush(product));
	}

	// ---------------------------------------------------------------- variants

	/** CA-8: 1-100 variants, all or nothing. */
	@Transactional
	public ProductResponse addVariants(Long productId, AddVariantsRequest req) {
		Product product = lockWithVariants(productId);
		List<VariantData> items = req.variants().stream().map(VariantData::of).toList();
		validateNewVariants(items, variants.findAllWithStock(productId), true);
		for (VariantData item : items) {
			saveNew(product, item);
		}
		return respond(product);
	}

	/** CA-9. A variant of another product answers 404 like an inexistent one (it is not found under this product). */
	@Transactional
	public ProductResponse updateVariant(Long productId, Long variantId, UpdateVariantRequest req) {
		Product product = lockWithVariants(productId);
		ProductVariant variant = variantOf(productId, variantId);
		if (req.version() != variant.getVersion()) {
			throw ApiException.conflict("resource.version_conflict");
		}
		VariantData data = new VariantData(req.sku(), req.size(), req.color(), req.minStock());
		if (!data.hasOptions()) {
			throw ApiException.badRequest("variant.options_required");
		}
		for (ProductVariant other : variants.findAllWithStock(productId)) {
			if (!other.getId().equals(variantId) && OptionKey.of(other.getSize(), other.getColor()).equals(data.key())) {
				throw ApiException.conflict("variant.options_conflict", data.label());
			}
		}
		if (data.sku() != null && variants.existsBySkuAndIdNot(data.sku(), variantId)) {
			throw ApiException.conflict("product.sku_conflict", data.sku());
		}
		variant.update(data.sku(), data.size(), data.color(), data.minStock());
		flush(variant, data);
		return respond(product);
	}

	/** CA-10: idempotent. The product lock serializes simultaneous toggles, so no retry is needed. */
	@Transactional
	public ProductResponse setVariantActive(Long productId, Long variantId, boolean active) {
		Product product = lockWithVariants(productId);
		ProductVariant variant = variantOf(productId, variantId);
		if (variant.isActive() != active) {
			variant.setActive(active);
			variants.saveAndFlush(variant);
		}
		return respond(product);
	}

	/** CA-12: the existing variant keeps its id, SKU, threshold and stock; the product version goes up. */
	@Transactional
	public ProductResponse enableVariants(Long productId, EnableVariantsRequest req) {
		Product product = lock(productId);
		if (product.hasVariants()) {
			throw ApiException.conflict("product.has_variants");
		}
		if (req.size() == null && req.color() == null) {
			throw ApiException.badRequest("variant.options_required");
		}
		ProductVariant only = onlyVariant(productId);
		only.setOptions(req.size(), req.color());
		product.setHasVariants(true);
		products.saveAndFlush(product);
		variants.saveAndFlush(only);
		return respond(product);
	}

	/** CA-13: only with exactly one variant (active or not); it loses its options and becomes active. */
	@Transactional
	public ProductResponse disableVariants(Long productId) {
		Product product = lock(productId);
		if (!product.hasVariants()) {
			throw ApiException.conflict("product.no_variants");
		}
		List<ProductVariant> all = variants.findAllWithStock(productId);
		if (all.size() != 1) {
			throw ApiException.conflict("product.has_multiple_variants");
		}
		ProductVariant only = all.get(0);
		only.setOptions(null, null);
		only.setActive(true);
		product.setHasVariants(false);
		products.saveAndFlush(product);
		variants.saveAndFlush(only);
		return respond(product);
	}

	// ---------------------------------------------------------------- helpers

	private Product get(Long id) {
		return products.findById(id).orElseThrow(() -> ApiException.notFound("product.not_found", String.valueOf(id)));
	}

	/** Product with a row lock that does not move its version (see the class comment). */
	private Product lock(Long id) {
		return products.findByIdForUpdate(id)
			.orElseThrow(() -> ApiException.notFound("product.not_found", String.valueOf(id)));
	}

	private Product lockWithVariants(Long id) {
		Product product = lock(id);
		if (!product.hasVariants()) {
			throw ApiException.conflict("product.no_variants");
		}
		return product;
	}

	private ProductVariant variantOf(Long productId, Long variantId) {
		return variants.findByIdAndProductId(variantId, productId)
			.orElseThrow(() -> ApiException.notFound("variant.not_found", String.valueOf(variantId)));
	}

	/** The one variant of a simple product. */
	private ProductVariant onlyVariant(Long productId) {
		List<ProductVariant> all = variants.findAllWithStock(productId);
		if (all.size() != 1) {
			throw new IllegalStateException("Simple product " + productId + " has " + all.size() + " variants");
		}
		return all.get(0);
	}

	/** Detail response: the product with its variants in the order of CA-14, read after any flush. */
	private ProductResponse respond(Product product) {
		List<ProductVariant> all = new ArrayList<>(variants.findAllWithStock(product.getId()));
		all.sort(VariantOrder.COMPARATOR);
		return ProductResponse.detail(product, categoryService.tree(), all);
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

	/**
	 * Friendly checks before inserting (400 options_required, 409 options_conflict and sku_conflict); the unique
	 * constraints remain the final guarantee under concurrency ({@link #translate}).
	 */
	private void validateNewVariants(List<VariantData> items, Collection<ProductVariant> existing,
			boolean optionsRequired) {
		if (optionsRequired) {
			for (VariantData item : items) {
				if (!item.hasOptions()) {
					throw ApiException.badRequest("variant.options_required");
				}
			}
		}
		Set<OptionKey> keys = new HashSet<>();
		for (ProductVariant v : existing) {
			keys.add(OptionKey.of(v.getSize(), v.getColor()));
		}
		Set<String> skus = new HashSet<>();
		for (VariantData item : items) {
			if (optionsRequired && !keys.add(item.key())) {
				throw ApiException.conflict("variant.options_conflict", item.label());
			}
			if (item.sku() != null && (!skus.add(item.sku()) || variants.existsBySku(item.sku()))) {
				throw ApiException.conflict("product.sku_conflict", item.sku());
			}
		}
	}

	private void saveNew(Product product, VariantData item) {
		ProductVariant variant = new ProductVariant(product, item.sku(), item.size(), item.color(), item.minStock(),
				clock.instant());
		flush(variant, item);
	}

	/** One INSERT/UPDATE at a time, so a constraint violation can be attributed to its variant. */
	private void flush(ProductVariant variant, VariantData data) {
		try {
			variants.saveAndFlush(variant);
		}
		catch (DataIntegrityViolationException ex) {
			throw translate(ex, data);
		}
	}

	private static RuntimeException translate(DataIntegrityViolationException ex, VariantData data) {
		if (violates(ex, SKU_CONSTRAINT)) {
			return ApiException.conflict("product.sku_conflict", data.sku());
		}
		if (violates(ex, OPTIONS_CONSTRAINT)) {
			return ApiException.conflict("variant.options_conflict", data.label());
		}
		return ex;
	}

	private static boolean violates(Throwable ex, String constraint) {
		// PostgreSQL reports uk_product_variants_sku, H2 UK_PRODUCT_VARIANTS_SKU: compare ignoring case
		for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
			String message = t.getMessage();
			if (message != null && message.toLowerCase(Locale.ROOT).contains(constraint)) {
				return true;
			}
		}
		return false;
	}

	/** "M / Rojo", "M" or "Rojo". */
	private static String optionsLabel(String size, String color) {
		if (size != null && color != null) {
			return size + " / " + color;
		}
		return size != null ? size : String.valueOf(color);
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
			// The category is not fetched: the response only needs its id, and the tree is in memory.
			List<Predicate> predicates = new ArrayList<>();
			if (query.q() != null) {
				String pattern = "%" + escapeLike(query.q().toLowerCase(Locale.ROOT)) + "%";
				// The SKU lives in the variants: EXISTS, so a product with several matches appears once (CA-16)
				Subquery<Long> skuMatch = cq.subquery(Long.class);
				Root<ProductVariant> variant = skuMatch.from(ProductVariant.class);
				skuMatch.select(variant.<Long>get("id"))
					.where(cb.equal(variant.get("product"), root),
							cb.like(cb.lower(variant.<String>get("sku")), pattern, '\\'));
				predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'), cb.exists(skuMatch)));
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
