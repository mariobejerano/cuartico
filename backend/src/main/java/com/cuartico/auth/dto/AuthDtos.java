package com.cuartico.auth.dto;

import com.cuartico.user.dto.UserDtos.UserResponse;

import jakarta.validation.constraints.NotBlank;

public final class AuthDtos {

	private AuthDtos() {
	}

	public record LoginRequest(@NotBlank String username, @NotBlank String password) {
	}

	public record RefreshRequest(@NotBlank String refreshToken) {
	}

	public record TokenResponse(String accessToken, String tokenType, long expiresIn, String refreshToken,
			UserResponse user) {

		public static TokenResponse bearer(String accessToken, long expiresIn, String refreshToken, UserResponse user) {
			return new TokenResponse(accessToken, "Bearer", expiresIn, refreshToken, user);
		}

	}

}
