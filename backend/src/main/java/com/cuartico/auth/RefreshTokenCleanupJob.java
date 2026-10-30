package com.cuartico.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Borra cada noche los refresh tokens ya expirados para que la tabla no crezca sin límite. */
@Component
public class RefreshTokenCleanupJob {

	private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupJob.class);

	private final RefreshTokenService refreshTokens;

	public RefreshTokenCleanupJob(RefreshTokenService refreshTokens) {
		this.refreshTokens = refreshTokens;
	}

	@Scheduled(cron = "0 0 3 * * *")
	public void purge() {
		int deleted = refreshTokens.purgeExpired();
		log.debug("Expired refresh tokens deleted: {}", deleted);
	}

}
