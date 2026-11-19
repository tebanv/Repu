package co.repu.r2dbc;

import co.repu.model.users.Session;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UsersRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HexFormat;

@Component
@RequiredArgsConstructor
@Log4j2
public class RedisSessionSecurityAdapter implements SessionSecurityGateway {

    private static final String KEY_PREFIX = "repu:auth:session:";
    private static final long SLIDING_THRESHOLD_SECONDS = 30 * 60L;
    private static final long ADMIN_IDLE_SECONDS = 8 * 60 * 60L;
    private static final long USER_IDLE_SECONDS = 7 * 24 * 60 * 60L;
    private static final long ADMIN_ABSOLUTE_SECONDS = 24 * 60 * 60L;
    private static final long USER_ABSOLUTE_SECONDS = 30 * 24 * 60 * 60L;

    private final ReactiveStringRedisTemplate redisTemplate;
    private final SessionRepositoryAdapter sessionRepository;
    private final UsersRepository usersRepository;

    @Override
    public Mono<Session> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Mono.empty();
        }

        String tokenHash = hashToken(rawToken);
        return redisTemplate.opsForValue().get(redisKey(tokenHash))
                .flatMap(this::loadCachedSession)
                .switchIfEmpty(sessionRepository.findByTokenHash(tokenHash)
                        .flatMap(this::hydrateAndCache))
                .filter(this::isActiveAndNotExpired)
                .flatMap(this::renewIfNeeded);
    }

    @Override
    public Mono<Void> cache(Session session) {
        if (session == null || session.getTokenHash() == null || session.getSessionId() == null
                || session.getExpiresAt() == null) {
            return Mono.error(new IllegalArgumentException("No se puede cachear una sesión incompleta"));
        }

        if (session.getAbsoluteExpiresAt() == null || session.getUserRole() == null) {
            return hydrateAndCache(session).then();
        }

        long ttl = Math.max(1, Duration.between(LocalDateTime.now(), session.getExpiresAt()).getSeconds());
        String metadata = session.getSessionId() + "|"
                + session.getAbsoluteExpiresAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                + "|" + session.getUserRole();
        return redisTemplate.opsForValue()
                .set(redisKey(session.getTokenHash()), metadata, Duration.ofSeconds(ttl))
                .doOnSuccess(ignored -> log.info("Sesión {} almacenada en Redis con TTL de {} segundos",
                        session.getSessionId(), ttl))
                .then();
    }

    @Override
    public Mono<Void> evict(Session session) {
        if (session == null || session.getTokenHash() == null) {
            return Mono.empty();
        }
        return redisTemplate.delete(redisKey(session.getTokenHash()))
                .doOnSuccess(ignored -> log.info("Sesión {} eliminada de Redis", session.getSessionId()))
                .then();
    }

    private Mono<Session> renewIfNeeded(Session session) {
        if (session.getAbsoluteExpiresAt() == null || session.getUserRole() == null) {
            return hydrateAndCache(session).flatMap(this::renewIfNeeded);
        }

        long remaining = Duration.between(LocalDateTime.now(), session.getExpiresAt()).getSeconds();
        if (remaining > SLIDING_THRESHOLD_SECONDS) {
            return Mono.just(session);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime slidingExpiry = now.plusSeconds(idleExpirationForRole(session.getUserRole()));
        LocalDateTime newExpiry = slidingExpiry.isAfter(session.getAbsoluteExpiresAt())
                ? session.getAbsoluteExpiresAt()
                : slidingExpiry;
        if (!newExpiry.isAfter(now)) {
            return Mono.empty();
        }
        session.setExpiresAt(newExpiry);
        return sessionRepository.touch(session)
                .flatMap(updated -> cache(updated).thenReturn(updated))
                .doOnSuccess(ignored -> log.info("Renovación deslizante aplicada a la sesión {}",
                        session.getSessionId()));
    }

    private boolean isActiveAndNotExpired(Session session) {
        return Boolean.TRUE.equals(session.getActive())
                && session.getExpiresAt() != null
                && session.getExpiresAt().isAfter(LocalDateTime.now())
                && (session.getAbsoluteExpiresAt() == null
                || session.getAbsoluteExpiresAt().isAfter(LocalDateTime.now()));
    }

    private Mono<Session> loadCachedSession(String metadata) {
        String[] parts = metadata.split("\\|", 3);
        final java.util.UUID sessionId;
        try {
            sessionId = java.util.UUID.fromString(parts[0]);
        } catch (RuntimeException exception) {
            return Mono.empty();
        }

        return sessionRepository.findBySessionId(sessionId)
                .flatMap(session -> {
                    if (parts.length != 3) {
                        return hydrateAndCache(session);
                    }
                    try {
                        LocalDateTime absoluteExpiry = LocalDateTime.ofInstant(
                                Instant.ofEpochMilli(Long.parseLong(parts[1])), ZoneId.systemDefault());
                        return Mono.just(session.toBuilder()
                                .absoluteExpiresAt(absoluteExpiry)
                                .userRole(parts[2])
                                .build());
                    } catch (RuntimeException exception) {
                        return hydrateAndCache(session);
                    }
                });
    }

    private Mono<Session> hydrateAndCache(Session session) {
        return usersRepository.findById(session.getUserId())
                .map(user -> {
                    LocalDateTime createdAt = session.getCreatedAt() == null
                            ? LocalDateTime.now() : session.getCreatedAt();
                    return session.toBuilder()
                            .userRole(user.getRole())
                            .absoluteExpiresAt(createdAt.plusSeconds(
                                    absoluteExpirationForRole(user.getRole())))
                            .build();
                })
                .flatMap(enriched -> cache(enriched).thenReturn(enriched));
    }

    private long idleExpirationForRole(String role) {
        return isPrivilegedRole(role) ? ADMIN_IDLE_SECONDS : USER_IDLE_SECONDS;
    }

    private long absoluteExpirationForRole(String role) {
        return isPrivilegedRole(role) ? ADMIN_ABSOLUTE_SECONDS : USER_ABSOLUTE_SECONDS;
    }

    private boolean isPrivilegedRole(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "ANALISTA".equalsIgnoreCase(role);
    }

    private String redisKey(String tokenHash) {
        return KEY_PREFIX + tokenHash;
    }

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("No fue posible proteger el token de sesión", exception);
        }
    }
}
