package com.cuartico.user;

import com.cuartico.config.AppProperties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Al arrancar con la base vacía, crea el primer administrador con app.admin.username/password.
 * Después de eso no hace nada: los demás usuarios se crean desde la API.
 */
@Component
public class AdminInitializer implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final AppProperties props;

	public AdminInitializer(UserRepository users, PasswordEncoder passwordEncoder, AppProperties props) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.props = props;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (users.count() > 0) {
			return;
		}
		AppProperties.Admin admin = props.admin();
		if (admin == null || !StringUtils.hasText(admin.username()) || !StringUtils.hasText(admin.password())) {
			log.warn("No users exist and APP_ADMIN_USERNAME / APP_ADMIN_PASSWORD are not set: nobody will be able to log in");
			return;
		}
		users.save(new User(admin.username(), passwordEncoder.encode(admin.password()), "Administrador", Role.ADMIN));
		log.info("Initial administrator user created: {}", admin.username());
	}

}
