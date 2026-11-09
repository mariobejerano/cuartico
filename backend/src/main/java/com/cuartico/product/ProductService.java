package com.cuartico.product;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {

	private static final String SKU_CONSTRAINT = "uk_products_sku";

	/** API sort field to entity property. Anything else answers request.invalid_sort. */
	private static final Map<String, String> SORT_FIELDS = Map.of("name", "name", "sku", "sku", "category",
			"category", "createdAt", "createdAt");

	private final ProductRepository products;

	private final AppProperties props;

	private final Clock clock;

	public ProductService(ProductRepository products, AppProperties props, Clock clock) {
		this.products = products;
		this.props = props;
		this.clock = clock;
	}

	public PageResponse<ProductResponse> search(ProductQuery query) {
		PageRequest pageable = PageRequest.of(query.pageOrDefault(), query.sizeOrDefault(),
				parseSort(query.sortOrDefault()));
		return PageResponse.from(products.findAll(toSpecification(query), pageable).map(ProductResponse::from));
	}

	public ProductResponse findById(Long id) {
		return ProductResponse.from(get(id));
	}

	/** Distinct non-null categories, case-insensitively de-duplicated and sorted. */
	public List<String> categories() {
		TreeSet<String> sorted = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
		sorted.addAll(products.findDistinctCategories());
		return List.copyOf(sorted);
	}

	@Transactional
	public ProductResponse create(CreateProductRequest req) {
		validateCurrency(req.salePrice() != null, req.salePriceCurrency());
		if (req.sku() != null && products.existsBySku(req.sku())) {
			throw ApiException.conflict("product.sku_conflict", req.sku());
		}
		Product product = new Product(req.name(), req.sku(), req.unit(), req.category(), req.salePrice(),
				req.salePriceCurrency(), req.minStock());
		// The stock row is created with zeros in the same transaction (ADR-002)
		product.attachStock(new ProductStock(product, clock.instant()));
		return ProductResponse.from(saveAndFlush(product));
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
		if (req.sku() != null && products.existsBySkuAndIdNot(req.sku(), id)) {
			throw ApiException.conflict("product.sku_conflict", req.sku());
		}
		product.update(req.name(), req.sku(), req.unit(), req.category(), req.salePrice(), req.salePriceCurrency(),
				req.minStock());
		return ProductResponse.from(saveAndFlush(product));
	}

	@Transactional
	public ProductResponse setActive(Long id, boolean active) {
		Product product = get(id);
		if (product.isActive() == active) {
			return ProductResponse.from(product);
		}
		product.setActive(active);
		return ProductResponse.from(saveAndFlush(product));
	}

	private Product get(Long id) {
		return products.findById(id).orElseThrow(() -> ApiException.notFound("product.not_found", String.valueOf(id)));
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

	private static Specification<Product> toSpecification(ProductQuery query) {
		return (root, cq, cb) -> {
			// The count query has no fetch: only the content query joins the stock row (one query, no N+1)
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
			if (query.category() != null) {
				predicates.add(cb.equal(cb.lower(root.get("category")), query.category().toLowerCase(Locale.ROOT)));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static String escapeLike(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
