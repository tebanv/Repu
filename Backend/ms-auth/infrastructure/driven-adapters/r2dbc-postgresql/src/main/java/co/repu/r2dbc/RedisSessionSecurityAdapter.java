package co.repu.r2dbc;

import co.repu.model.users.Session;
import co.repu.model.users.gateways.SessionSecurityGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Component
@RequiredArgsConstructor
@Log4j2
public class RedisSessionSecurityAdapter implements SessionSecurityGateway {

    private static final String KEY_PREFIX = "repu:auth:session:";
    private static final long SLIDING_THRESHOLD_SECONDS = 30 * 60L;

    private final ReactiveStringRedisTemplate redisTemplate;
    private final SessionRepositoryAdapter sessionRepository;

    @Override
    public Mono<Session> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Mono.empty();
        }

        String tokenHash = hashToken(rawToken);
        return redisTemplate.opsForValue().get(redisKey(tokenHash))
                .flatMap(sessionId -> sessionRepository.findBySessionId(java.util.UUID.fromString(sessionId)))
                .switchIfEmpty(sessionRepository.findByTokenHash(tokenHash)
                        .flatMap(session -> cache(session).thenReturn(session)))
                .filter(this::isActiveAndNotExpired)
                .flatMap(this::renewIfNeeded);
    }

    @Override
    public Mono<Void> cache(Session session) {
        if (session == null || session.getTokenHash() == null || session.getSessionId() == null) {
            return Mono.error(new IllegalArgumentException("No se puede cachear una sesión incompleta"));
        }

        long ttl = Math.max(1, Duration.between(LocalDateTime.now(), session.getExpiresAt()).getSeconds());
        return redisTemplate.opsForValue()
                .set(redisKey(session.getTokenHash()), session.getSessionId().toString(), Duration.ofSeconds(ttl))
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
        long remaining = Duration.between(LocalDateTime.now(), session.getExpiresAt()).getSeconds();
        if (remaining > SLIDING_THRESHOLD_SECONDS) {
            return Mono.just(session);
        }

        long extension = Duration.between(session.getLastAccess(), session.getExpiresAt()).getSeconds();
        session.setExpiresAt(LocalDateTime.now().plusSeconds(Math.max(extension, 60)));
        return sessionRepository.touch(session)
                .flatMap(updated -> cache(updated).thenReturn(updated))
                .doOnSuccess(ignored -> log.info("Renovación deslizante aplicada a la sesión {}",
                        session.getSessionId()));
    }

    private boolean isActiveAndNotExpired(Session session) {
        return Boolean.TRUE.equals(session.getActive())
                && session.getExpiresAt() != null
                && session.getExpiresAt().isAfter(LocalDateTime.now());
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
