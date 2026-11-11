package com.cuartico.category;

import java.net.URI;
import java.util.List;

import com.cuartico.category.dto.CategoryDtos.CategoryResponse;
import com.cuartico.category.dto.CategoryDtos.CreateCategoryRequest;
import com.cuartico.category.dto.CategoryDtos.UpdateCategoryRequest;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** Category tree. ADMIN and OPERATOR read; only ADMIN creates, renames, activates and deactivates. There is no DELETE. */
@RestController
@RequestMapping("/api/v1/categories")
@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
public class CategoryController {

	private final CategoryService categoryService;

	public CategoryController(CategoryService categoryService) {
		this.categoryService = categoryService;
	}

	@GetMapping
	public List<CategoryResponse> list(@RequestParam(required = false) Boolean active) {
		return categoryService.list(active);
	}

	@GetMapping("/{id}")
	public CategoryResponse get(@PathVariable Long id) {
		return categoryService.findById(id);
	}

	@PostMapping
	@PreAuthorize("hasRole('ADMIN')")
	public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CreateCategoryRequest req) {
		CategoryResponse created = categoryService.create(req);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").build(created.id());
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasRole('ADMIN')")
	public CategoryResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCategoryRequest req) {
		return categoryService.update(id, req);
	}

	@PostMapping("/{id}/deactivate")
	@PreAuthorize("hasRole('ADMIN')")
	public CategoryResponse deactivate(@PathVariable Long id) {
		return categoryService.setActive(id, false);
	}

	@PostMapping("/{id}/activate")
	@PreAuthorize("hasRole('ADMIN')")
	public CategoryResponse activate(@PathVariable Long id) {
		return categoryService.setActive(id, true);
	}

}
