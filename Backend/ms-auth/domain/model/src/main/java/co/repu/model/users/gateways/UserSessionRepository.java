package co.repu.model.users.gateways;

import co.repu.model.users.Session;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface UserSessionRepository {
    Mono<Session> save(Session session);
    Mono<Session> findByTokenHash(String tokenHash);
    Mono<Session> findBySessionId(UUID sessionId);
    Flux<Session> findActiveByUserId(UUID userId);
    Mono<Session> touch(Session session);
    Mono<Void> deactivateAllByUserId(UUID userId);
    Mono<Void> deactivateBySessionId(UUID sessionId);
}