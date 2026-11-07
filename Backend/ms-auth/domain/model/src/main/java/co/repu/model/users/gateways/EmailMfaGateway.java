package co.repu.model.users.gateways;

import reactor.core.publisher.Mono;

import java.util.UUID;

public interface EmailMfaGateway {
    Mono<String> createAndSendChallenge(UUID userId, String email, String firstName);
    Mono<UUID> verifyChallenge(String challengeId, String code);
}
