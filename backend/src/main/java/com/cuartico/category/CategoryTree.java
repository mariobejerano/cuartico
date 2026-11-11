package com.cuartico.category;

import java.text.Collator;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.cuartico.category.dto.CategoryDtos.CategoryRef;

/**
 * Whole category tree in memory (tens of rows). Paths and descendants are computed here instead of
 * in SQL: simpler, portable across H2 and PostgreSQL and enough at this size (ADR-003).
 */
public final class CategoryTree {

	public static final String SEPARATOR = " › ";

	/** Spanish collation at primary strength: ignores accents and case ("Ácidos" sorts before "Zumos"). Ties fall back to the id. */
	private static final Collator COLLATOR = newCollator();

	private final Map<Long, Category> byId = new HashMap<>();

	private final Map<Long, Long> parentOf = new HashMap<>();

	private final Map<Long, List<Long>> childrenOf = new HashMap<>();

	CategoryTree(List<Category> categories) {
		for (Category c : categories) {
			byId.put(c.getId(), c);
			Long parentId = c.getParent() == null ? null : c.getParent().getId();
			parentOf.put(c.getId(), parentId);
			if (parentId != null) {
				childrenOf.computeIfAbsent(parentId, k -> new ArrayList<>()).add(c.getId());
			}
		}
	}

	private static Collator newCollator() {
		Collator collator = Collator.getInstance(java.util.Locale.forLanguageTag("es"));
		collator.setStrength(Collator.PRIMARY);
		return collator;
	}

	public boolean contains(Long id) {
		return byId.containsKey(id);
	}

	public Category get(Long id) {
		return byId.get(id);
	}

	public ProductType typeOf(Long id) {
		return byId.get(id).getProductType();
	}

	public String path(Long id) {
		return join(id, false);
	}

	public String pathEn(Long id) {
		return join(id, true);
	}

	public CategoryRef ref(Long id) {
		Category c = byId.get(id);
		return new CategoryRef(c.getId(), c.getName(), c.getNameEn(), path(id), pathEn(id), c.isActive());
	}

	/** The category and all its descendants; empty if the id does not exist. */
	public Set<Long> descendantIds(Long id) {
		if (!byId.containsKey(id)) {
			return Collections.emptySet();
		}
		Set<Long> result = new LinkedHashSet<>();
		Deque<Long> pending = new ArrayDeque<>();
		pending.add(id);
		while (!pending.isEmpty()) {
			Long current = pending.poll();
			if (result.add(current)) {
				pending.addAll(childrenOf.getOrDefault(current, List.of()));
			}
		}
		return result;
	}

	/** Order by path, case-insensitive, comparing level by level so a parent always precedes its children. */
	public Comparator<Long> pathOrder() {
		return (a, b) -> {
			List<String> pa = segments(a);
			List<String> pb = segments(b);
			for (int i = 0; i < Math.min(pa.size(), pb.size()); i++) {
				int cmp = COLLATOR.compare(pa.get(i), pb.get(i));
				if (cmp != 0) {
					return cmp;
				}
			}
			int bySize = Integer.compare(pa.size(), pb.size());
			return bySize != 0 ? bySize : Long.compare(a, b);
		};
	}

	private List<String> segments(Long id) {
		List<String> segments = new ArrayList<>();
		for (Long cur = id; cur != null; cur = parentOf.get(cur)) {
			segments.add(0, byId.get(cur).getName());
		}
		return segments;
	}

	private String join(Long id, boolean english) {
		List<String> names = new ArrayList<>();
		for (Long cur = id; cur != null; cur = parentOf.get(cur)) {
			Category c = byId.get(cur);
			names.add(0, english && c.getNameEn() != null ? c.getNameEn() : c.getName());
		}
		return String.join(SEPARATOR, names);
	}

}
