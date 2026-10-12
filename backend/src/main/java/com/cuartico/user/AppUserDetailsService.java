package com.cuartico.user;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** Puente entre nuestra tabla users y Spring Security, usado solo en el login. */
@Service
public class AppUserDetailsService implements UserDetailsService {

	private final UserRepository users;

	public AppUserDetailsService(UserRepository users) {
		this.users = users;
	}

	@Override
	public UserDetails loadUserByUsername(String username) {
		User user = users.findByUsername(username)
			.orElseThrow(() -> new UsernameNotFoundException(username));
		return org.springframework.security.core.userdetails.User.withUsername(user.getUsername())
			.password(user.getPasswordHash())
			.roles(user.getRole().name())
			.disabled(!user.isActive())
			.build();
	}

}
