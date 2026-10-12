package com.cuartico.auth;

import com.cuartico.auth.dto.AuthDtos.TokenResponse;
import com.cuartico.user.User;
import com.cuartico.user.UserService;
import com.cuartico.user.dto.UserDtos.UserResponse;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final AuthenticationManager authenticationManager;

	private final UserService userService;

	private final AccessTokenService accessTokens;

	private final RefreshTokenService refreshTokens;

	public AuthService(AuthenticationManager authenticationManager, UserService userService,
			AccessTokenService accessTokens, RefreshTokenService refreshTokens) {
		this.authenticationManager = authenticationManager;
		this.userService = userService;
		this.accessTokens = accessTokens;
		this.refreshTokens = refreshTokens;
	}

	/** Valida usuario y contraseña (lanza BadCredentials/Disabled si falla) y emite los tokens. */
	@Transactional
	public TokenResponse login(String username, String password) {
		authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(username, password));
		return issueTokens(userService.getByUsername(username));
	}

	@Transactional(noRollbackFor = com.cuartico.common.ApiException.class)
	public TokenResponse refresh(String refreshToken) {
		return issueTokens(refreshTokens.consume(refreshToken));
	}

	public void logout(String refreshToken) {
		refreshTokens.revoke(refreshToken);
	}

	private TokenResponse issueTokens(User user) {
		return TokenResponse.bearer(accessTokens.issue(user), accessTokens.ttlSeconds(), refreshTokens.issue(user),
				UserResponse.from(user));
	}

}
