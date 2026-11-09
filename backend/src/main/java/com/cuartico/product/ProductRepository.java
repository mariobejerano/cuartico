package com.cuartico.product;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

	boolean existsBySku(String sku);

	boolean existsBySkuAndIdNot(String sku, Long id);

	@Query("select distinct p.category from Product p where p.category is not null")
	List<String> findDistinctCategories();

}
