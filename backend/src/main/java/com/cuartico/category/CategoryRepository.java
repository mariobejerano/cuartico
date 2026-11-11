package com.cuartico.category;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, Long> {

	/** Row lock: serializes "create child", "deactivate" and "activate" around the same node (ADR-003). */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select c from Category c where c.id = :id")
	Optional<Category> findByIdForUpdate(@Param("id") Long id);

	/** Scalar query (does not load the entity, so a later row lock reads fresh state). */
	@Query("select c.parent.id from Category c where c.id = :id")
	Optional<Long> findParentId(@Param("id") Long id);

	@Query("select count(c) > 0 from Category c where c.parent is null and c.nameKey = lower(trim(:name)) and c.id <> :excludeId")
	boolean existsRootByName(@Param("name") String name, @Param("excludeId") Long excludeId);

	@Query("select count(c) > 0 from Category c where c.parent.id = :parentId and c.nameKey = lower(trim(:name)) and c.id <> :excludeId")
	boolean existsChildByName(@Param("parentId") Long parentId, @Param("name") String name,
			@Param("excludeId") Long excludeId);

	@Query("select count(c) > 0 from Category c where c.parent.id = :parentId and c.active = true")
	boolean hasActiveChildren(@Param("parentId") Long parentId);

	/**
	 * Products assigned directly to each category (active and inactive): one GROUP BY. The entity is
	 * referenced by name only, so this module has no compile-time dependency on the product module.
	 */
	@Query("select p.category.id, count(p) from Product p group by p.category.id")
	List<Object[]> countProductsByCategory();

}
