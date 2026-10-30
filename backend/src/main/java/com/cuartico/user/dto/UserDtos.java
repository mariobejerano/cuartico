package com.cuartico.user.dto;

import java.time.Instant;

import com.cuartico.user.Role;
import com.cuartico.user.User;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** DTOs del módulo de usuarios. La entidad nunca sale directamente por la API. */
public final class UserDtos {

	private UserDtos() {
	}

	public record UserResponse(Long id, String username, String fullName, Role role, boolean active,
			Instant createdAt) {

		public static UserResponse from(User user) {
			return new UserResponse(user.getId(), user.getUsername(), user.getFullName(), user.getRole(),
					user.isActive(), user.getCreatedAt());
		}

	}

	public record CreateUserRequest(
			@NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
					message = "{user.username.pattern}") String username,
			@NotBlank @Size(min = 8, max = 72) String password,
			@NotBlank @Size(max = 100) String fullName,
			@NotNull Role role) {
	}

	public record UpdateUserRequest(
			@NotBlank @Size(max = 100) String fullName,
			@NotNull Role role,
			boolean active) {
	}

	public record ChangePasswordRequest(
			@NotBlank String currentPassword,
			@NotBlank @Size(min = 8, max = 72) String newPassword) {
	}

	public record ResetPasswordRequest(@NotBlank @Size(min = 8, max = 72) String newPassword) {
	}

}
