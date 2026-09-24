package co.com.repu.model.user.gateways;

import co.com.repu.model.user.PasswordResetToken;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface PasswordResetRepository {
    Mono<Void> invalidateActiveTokens(UUID userId);
    Mono<PasswordResetToken> create(UUID userId, String codeHash, int expirationMinutes, int maxAttempts);
    Mono<PasswordResetToken> findValid(UUID userId, String codeHash);
    Mono<PasswordResetToken> findActiveByUserId(UUID userId);
    Mono<Boolean> incrementFailedAttempts(UUID tokenId);
    Mono<Void> updatePasswordAndInvalidateSessions(UUID userId, String passwordHash, UUID tokenId);
}
