package co.repu.model.users.gateways;

import reactor.core.publisher.Mono;

public interface LoginProtectionGateway {
    Mono<Void> checkIpLimit(String ipAddress);
    Mono<Void> checkAccountLock(String email);
    Mono<Void> recordFailedAttempt(String email);
    Mono<Void> clearFailedAttempts(String email);
}
