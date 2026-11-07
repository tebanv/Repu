package co.repu.r2dbc;

import co.repu.model.users.LoginRateLimitExceededException;
import co.repu.model.users.MfaVerificationException;
import co.repu.model.users.gateways.EmailMfaGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import jakarta.annotation.PostConstruct;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class EmailMfaAdapter implements EmailMfaGateway {

    private static final String CHALLENGE_PREFIX = "repu:auth:mfa:challenge:";
    private static final String ATTEMPTS_PREFIX = "repu:auth:mfa:attempts:";
    private static final String SEND_PREFIX = "repu:auth:mfa:send:";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final DefaultRedisScript<String> VERIFY_SCRIPT = new DefaultRedisScript<>("""
            local challenge = redis.call('GET', KEYS[1])
            if not challenge then return 'EXPIRED' end
            local separator = string.find(challenge, '|', 1, true)
            if not separator then
              redis.call('DEL', KEYS[1])
              return 'EXPIRED'
            end
            if string.sub(challenge, separator + 1) == ARGV[1] then
              local userId = string.sub(challenge, 1, separator - 1)
              redis.call('DEL', KEYS[1])
              redis.call('DEL', KEYS[2])
              return userId
            end
            local attempts = redis.call('INCR', KEYS[2])
            if attempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
            if attempts >= tonumber(ARGV[3]) then
              redis.call('DEL', KEYS[1])
              return 'LOCKED'
            end
            return 'INVALID'
            """, String.class);

    private final ReactiveStringRedisTemplate redisTemplate;
    private final JavaMailSender mailSender;

    @Value("${security.mfa.hmac-secret}")
    private String hmacSecret;

    @Value("${security.mfa.code-ttl-seconds:300}")
    private long codeTtlSeconds;

    @Value("${security.mfa.max-attempts:5}")
    private int maxAttempts;

    @Value("${security.mfa.email-from:no-reply@repu.local}")
    private String sender;

    @PostConstruct
    void validateConfiguration() {
        if (hmacSecret == null || hmacSecret.isBlank()) {
            throw new IllegalStateException("MFA_HMAC_SECRET o AUTH_SERVICE_TOKEN debe estar configurado");
        }
        if (codeTtlSeconds <= 0 || maxAttempts <= 0) {
            throw new IllegalStateException("La configuración de expiración e intentos MFA debe ser positiva");
        }
    }

    @Override
    public Mono<String> createAndSendChallenge(UUID userId, String email, String firstName) {
        String challengeId = UUID.randomUUID().toString();
        String code = String.format(Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));
        String challengeKey = CHALLENGE_PREFIX + challengeId;
        String sendKey = SEND_PREFIX + digest(email == null ? "" : email.strip().toLowerCase(Locale.ROOT));

        return redisTemplate.opsForValue().setIfAbsent(sendKey, "1", Duration.ofSeconds(60))
                .flatMap(allowed -> {
                    if (!Boolean.TRUE.equals(allowed)) {
                        return Mono.error(new LoginRateLimitExceededException(60));
                    }
                    return redisTemplate.opsForValue()
                            .set(challengeKey, userId + "|" + hashCode(challengeId, code),
                                    Duration.ofSeconds(codeTtlSeconds))
                            .then(sendEmail(email, firstName, code))
                            .thenReturn(challengeId)
                            .onErrorResume(error -> redisTemplate.delete(challengeKey)
                                    .then(Mono.error(error)));
                });
    }

    @Override
    public Mono<UUID> verifyChallenge(String challengeId, String code) {
        final UUID parsedChallengeId;
        try {
            parsedChallengeId = UUID.fromString(challengeId);
        } catch (RuntimeException exception) {
            return Mono.error(new MfaVerificationException(false));
        }
        String safeCode = code == null ? "" : code;
        String challengeKey = CHALLENGE_PREFIX + parsedChallengeId;
        String attemptsKey = ATTEMPTS_PREFIX + parsedChallengeId;
        return redisTemplate.execute(VERIFY_SCRIPT,
                        List.of(challengeKey, attemptsKey),
                        hashCode(parsedChallengeId.toString(), safeCode),
                        Long.toString(codeTtlSeconds),
                        Integer.toString(maxAttempts))
                .single()
                .flatMap(result -> {
                    if ("INVALID".equals(result) || "EXPIRED".equals(result)) {
                        return Mono.error(new MfaVerificationException(false));
                    }
                    if ("LOCKED".equals(result)) {
                        return Mono.error(new MfaVerificationException(true));
                    }
                    try {
                        return Mono.just(UUID.fromString(result));
                    } catch (RuntimeException exception) {
                        return Mono.error(new MfaVerificationException(false));
                    }
                });
    }

    private Mono<Void> sendEmail(String email, String firstName, String code) {
        return Mono.fromRunnable(() -> {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(sender);
            message.setTo(email);
            message.setSubject("Código de verificación de REPU");
            message.setText("""
                    Hola %s,

                    Tu código para iniciar sesión es: %s

                    Este código vence en %d minutos y solo puede utilizarse una vez.
                    Si no intentaste iniciar sesión, ignora este mensaje.

                    Equipo REPU
                    """.formatted(firstName == null ? "usuario" : firstName, code,
                    Math.max(1, Duration.ofSeconds(codeTtlSeconds).toMinutes())));
            mailSender.send(message);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    private String hashCode(String challengeId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal((challengeId + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("No fue posible proteger el código MFA", exception);
        }
    }

    private String digest(String value) {
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("No fue posible proteger el correo MFA", exception);
        }
    }
}
