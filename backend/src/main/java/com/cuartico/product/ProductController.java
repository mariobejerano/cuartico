package com.cuartico.product;

import java.net.URI;

import com.cuartico.common.ApiException;
import com.cuartico.common.dto.PageResponse;
import com.cuartico.product.dto.ProductDtos.AddVariantsRequest;
import com.cuartico.product.dto.ProductDtos.CreateProductRequest;
import com.cuartico.product.dto.ProductDtos.EnableVariantsRequest;
import com.cuartico.product.dto.ProductDtos.ProductQuery;
import com.cuartico.product.dto.ProductDtos.ProductResponse;
import com.cuartico.product.dto.ProductDtos.UpdateProductRequest;
import com.cuartico.product.dto.ProductDtos.UpdateVariantRequest;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Product catalog and its variants. ADMIN and OPERATOR read, create, edit and convert; only ADMIN activates and
 * deactivates (products and variants). The variant endpoints answer the whole product (HU-16).
 */
@RestController
@RequestMapping("/api/v1/products")
@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
public class ProductController {

	private final ProductService productService;

	public ProductController(ProductService productService) {
		this.productService = productService;
	}

	@GetMapping
	public PageResponse<ProductResponse> list(@Valid @ModelAttribute ProductQuery query) {
		return productService.search(query);
	}

	/** Retired by HU-15 (replaced by GET /api/v1/categories). Kept so it answers 404 and not "id is not a number". */
	@Hidden
	@GetMapping("/categories")
	public void retiredCategories() {
		throw ApiException.notFound("request.not_found");
	}

	@GetMapping("/{id}")
	public ProductResponse get(@PathVariable Long id) {
		return productService.findById(id);
	}

	@PostMapping
	public ResponseEntity<ProductResponse> create(@Valid @RequestBody CreateProductRequest req) {
		ProductResponse created = productService.create(req);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").build(created.id());
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	public ProductResponse update(@PathVariable Long id, @Valid @RequestBody UpdateProductRequest req) {
		return productService.update(id, req);
	}

	@PostMapping("/{id}/deactivate")
	@PreAuthorize("hasRole('ADMIN')")
	public ProductResponse deactivate(@PathVariable Long id) {
		return productService.setActive(id, false);
	}

	@PostMapping("/{id}/activate")
	@PreAuthorize("hasRole('ADMIN')")
	public ProductResponse activate(@PathVariable Long id) {
		return productService.setActive(id, true);
	}

	// ---------------------------------------------------------------- variants (HU-16)

	@PostMapping("/{id}/variants")
	public ResponseEntity<ProductResponse> addVariants(@PathVariable Long id,
			@Valid @RequestBody AddVariantsRequest req) {
		ProductResponse product = productService.addVariants(id, req);
		URI location = ServletUriComponentsBuilder.fromCurrentContextPath().path("/api/v1/products/{id}").build(id);
		return ResponseEntity.created(location).body(product);
	}

	@PutMapping("/{id}/variants/{variantId}")
	public ProductResponse updateVariant(@PathVariable Long id, @PathVariable Long variantId,
			@Valid @RequestBody UpdateVariantRequest req) {
		return productService.updateVariant(id, variantId, req);
	}

	@PostMapping("/{id}/variants/{variantId}/deactivate")
	@PreAuthorize("hasRole('ADMIN')")
	public ProductResponse deactivateVariant(@PathVariable Long id, @PathVariable Long variantId) {
		return productService.setVariantActive(id, variantId, false);
	}

	@PostMapping("/{id}/variants/{variantId}/activate")
	@PreAuthorize("hasRole('ADMIN')")
	public ProductResponse activateVariant(@PathVariable Long id, @PathVariable Long variantId) {
		return productService.setVariantActive(id, variantId, true);
	}

	@PostMapping("/{id}/variants/enable")
	public ProductResponse enableVariants(@PathVariable Long id, @Valid @RequestBody EnableVariantsRequest req) {
		return productService.enableVariants(id, req);
	}

	@PostMapping("/{id}/variants/disable")
	public ProductResponse disableVariants(@PathVariable Long id) {
		return productService.disableVariants(id);
	}

}
