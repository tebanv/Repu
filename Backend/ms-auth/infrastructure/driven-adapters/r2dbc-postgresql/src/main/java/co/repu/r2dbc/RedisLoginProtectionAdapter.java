package co.repu.r2dbc;

import co.repu.model.users.LoginRateLimitExceededException;
import co.repu.model.users.gateways.LoginProtectionGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class RedisLoginProtectionAdapter implements LoginProtectionGateway {

    private static final String IP_PREFIX = "repu:auth:login:ip:";
    private static final String FAILURE_PREFIX = "repu:auth:login:failures:";
    private static final String LOCK_PREFIX = "repu:auth:login:lock:";
    private static final Duration IP_WINDOW = Duration.ofMinutes(1);
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final Duration ACCOUNT_LOCK = Duration.ofMinutes(15);

    private final ReactiveStringRedisTemplate redisTemplate;

    @Value("${security.login.ip-max-attempts:20}")
    private int ipMaxAttempts;

    @Value("${security.login.account-max-failures:5}")
    private int accountMaxFailures;

    @Override
    public Mono<Void> checkIpLimit(String ipAddress) {
        String key = IP_PREFIX + digest(ipAddress == null || ipAddress.isBlank() ? "unknown" : ipAddress);
        return redisTemplate.opsForValue().increment(key)
                .flatMap(attempts -> (attempts == 1
                        ? redisTemplate.expire(key, IP_WINDOW)
                                .flatMap(this::requireExpiration)
                        : Mono.<Void>empty())
                        .then(Mono.defer(() -> attempts > ipMaxAttempts
                                ? retryAfter(key)
                                : Mono.empty())));
    }

    @Override
    public Mono<Void> checkAccountLock(String email) {
        String key = LOCK_PREFIX + digest(normalizeEmail(email));
        return redisTemplate.hasKey(key)
                .flatMap(locked -> Boolean.TRUE.equals(locked) ? retryAfter(key) : Mono.empty());
    }

    @Override
    public Mono<Void> recordFailedAttempt(String email) {
        String accountKey = digest(normalizeEmail(email));
        String failuresKey = FAILURE_PREFIX + accountKey;
        String lockKey = LOCK_PREFIX + accountKey;
        return redisTemplate.opsForValue().increment(failuresKey)
                .flatMap(failures -> (failures == 1
                        ? redisTemplate.expire(failuresKey, FAILURE_WINDOW)
                                .flatMap(this::requireExpiration)
                        : Mono.<Void>empty())
                        .then(Mono.defer(() -> failures >= accountMaxFailures
                                ? redisTemplate.opsForValue()
                                        .setIfAbsent(lockKey, "1", ACCOUNT_LOCK)
                                        .then()
                                : Mono.empty())));
    }

    @Override
    public Mono<Void> clearFailedAttempts(String email) {
        String accountKey = digest(normalizeEmail(email));
        return redisTemplate.delete(
                FAILURE_PREFIX + accountKey,
                LOCK_PREFIX + accountKey).then();
    }

    private Mono<Void> retryAfter(String key) {
        return redisTemplate.getExpire(key)
                .defaultIfEmpty(Duration.ofMinutes(1))
                .flatMap(ttl -> Mono.error(new LoginRateLimitExceededException(
                        Math.max(1, ttl.getSeconds()))));
    }

    private Mono<Void> requireExpiration(Boolean expired) {
        return Boolean.TRUE.equals(expired)
                ? Mono.empty()
                : Mono.error(new IllegalStateException("No se pudo aplicar TTL al contador de intentos"));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    private String digest(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("No fue posible proteger el identificador de login", exception);
        }
    }
}
