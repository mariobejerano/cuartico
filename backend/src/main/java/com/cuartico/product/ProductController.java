package com.cuartico.product;

import java.net.URI;
import java.util.List;

import com.cuartico.common.dto.PageResponse;
import com.cuartico.product.dto.ProductDtos.CreateProductRequest;
import com.cuartico.product.dto.ProductDtos.ProductQuery;
import com.cuartico.product.dto.ProductDtos.ProductResponse;
import com.cuartico.product.dto.ProductDtos.UpdateProductRequest;

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

/** Product catalog. ADMIN and OPERATOR read, create and edit; only ADMIN activates/deactivates. */
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

	@GetMapping("/categories")
	public List<String> categories() {
		return productService.categories();
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

}
