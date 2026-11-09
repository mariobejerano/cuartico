package com.cuartico.common;

/** Helpers to normalize user input before validation (used from DTO compact constructors). */
public final class Normalize {

	private Normalize() {
	}

	/** Trims the text; null or blank becomes null. */
	public static String blankToNull(String value) {
		if (value == null) {
			return null;
		}
		String stripped = value.strip();
		return stripped.isEmpty() ? null : stripped;
	}

}
