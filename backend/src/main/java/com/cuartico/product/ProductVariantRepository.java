package com.cuartico.product;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

	boolean existsBySku(String sku);

	boolean existsBySkuAndIdNot(String sku, Long id);

	Optional<ProductVariant> findByIdAndProductId(Long id, Long productId);

	@Query("select v from ProductVariant v join fetch v.stock where v.product.id = :productId")
	List<ProductVariant> findAllWithStock(@Param("productId") Long productId);

	long countByProductId(Long productId);

	/**
	 * Aggregate per product for the list (CA-15), over ALL variants, active or not, in one GROUP BY so the list never
	 * loads variants row by row. Columns: product id, variant count, sum onHand, sum reserved, sum(onHand * averageCost),
	 * sum onHand of the variants with cost, 1 if some ACTIVE variant is low, then sku, minStock, averageCost and
	 * costCurrency (the values of the only variant: they are used for simple products only).
	 */
	@Query("""
			select v.product.id, count(v), sum(s.onHand), sum(s.reserved), sum(s.onHand * s.averageCost),
			       sum(case when s.averageCost is not null then s.onHand end),
			       max(case when v.active = true and v.minStock > 0 and (s.onHand - s.reserved) <= v.minStock then 1 else 0 end),
			       min(v.sku), min(v.minStock), max(s.averageCost), max(s.costCurrency)
			from ProductVariant v join v.stock s
			where v.product.id in :productIds
			group by v.product.id
			""")
	List<Object[]> aggregateByProductIds(@Param("productIds") Collection<Long> productIds);

}
