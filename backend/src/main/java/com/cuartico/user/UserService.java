package com.cuartico.user;

import java.util.List;

import com.cuartico.auth.RefreshTokenService;
import com.cuartico.common.ApiException;
import com.cuartico.user.dto.UserDtos.ChangePasswordRequest;
import com.cuartico.user.dto.UserDtos.CreateUserRequest;
import com.cuartico.user.dto.UserDtos.UpdateUserRequest;
import com.cuartico.user.dto.UserDtos.UserResponse;

import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final RefreshTokenService refreshTokens;

	public UserService(UserRepository users, PasswordEncoder passwordEncoder, RefreshTokenService refreshTokens) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokens = refreshTokens;
	}

	public List<UserResponse> findAll() {
		return users.findAll(Sort.by("username")).stream().map(UserResponse::from).toList();
	}

	public UserResponse findById(Long id) {
		return UserResponse.from(get(id));
	}

	public User getByUsername(String username) {
		return users.findByUsername(username)
			.orElseThrow(() -> ApiException.notFound("Usuario no encontrado: " + username));
	}

	@Transactional
	public UserResponse create(CreateUserRequest req) {
		if (users.existsByUsername(req.username())) {
			throw ApiException.conflict("Ya existe un usuario con ese nombre: " + req.username());
		}
		User user = new User(req.username(), passwordEncoder.encode(req.password()), req.fullName(), req.role());
		return UserResponse.from(users.save(user));
	}

	@Transactional
	public UserResponse update(Long id, UpdateUserRequest req, String currentUsername) {
		User user = get(id);
		if (user.getUsername().equals(currentUsername) && (!req.active() || req.role() != Role.ADMIN)) {
			throw ApiException.badRequest("No puedes desactivarte ni quitarte el rol de administrador a ti mismo");
		}
		user.update(req.fullName(), req.role(), req.active());
		if (!req.active()) {
			// Un usuario desactivado pierde sus sesiones al instante
			refreshTokens.revokeAll(user);
		}
		return UserResponse.from(user);
	}

	/** El usuario cambia su propia contraseña (requiere la actual). */
	@Transactional
	public void changeOwnPassword(String username, ChangePasswordRequest req) {
		User user = getByUsername(username);
		if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
			throw ApiException.badRequest("La contraseña actual no es correcta");
		}
		user.changePassword(passwordEncoder.encode(req.newPassword()));
		refreshTokens.revokeAll(user);
	}

	/** Un administrador restablece la contraseña de otro usuario. */
	@Transactional
	public void resetPassword(Long id, String newPassword) {
		User user = get(id);
		user.changePassword(passwordEncoder.encode(newPassword));
		refreshTokens.revokeAll(user);
	}

	private User get(Long id) {
		return users.findById(id).orElseThrow(() -> ApiException.notFound("Usuario no encontrado: " + id));
	}

}
