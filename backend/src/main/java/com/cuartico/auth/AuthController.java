package com.cuartico.auth;

import com.cuartico.auth.dto.AuthDtos.LoginRequest;
import com.cuartico.auth.dto.AuthDtos.RefreshRequest;
import com.cuartico.auth.dto.AuthDtos.TokenResponse;
import com.cuartico.user.UserService;
import com.cuartico.user.dto.UserDtos.ChangePasswordRequest;
import com.cuartico.user.dto.UserDtos.UserResponse;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	private final UserService userService;

	public AuthController(AuthService authService, UserService userService) {
		this.authService = authService;
		this.userService = userService;
	}

	@PostMapping("/login")
	public TokenResponse login(@Valid @RequestBody LoginRequest req) {
		return authService.login(req.username(), req.password());
	}

	@PostMapping("/refresh")
	public TokenResponse refresh(@Valid @RequestBody RefreshRequest req) {
		return authService.refresh(req.refreshToken());
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(@Valid @RequestBody RefreshRequest req) {
		authService.logout(req.refreshToken());
	}

	/** Datos del usuario autenticado (útil para el frontend al recargar la página). */
	@GetMapping("/me")
	public UserResponse me(Authentication auth) {
		return UserResponse.from(userService.getByUsername(auth.getName()));
	}

	@PostMapping("/change-password")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void changePassword(@Valid @RequestBody ChangePasswordRequest req, Authentication auth) {
		userService.changeOwnPassword(auth.getName(), req);
	}

}
