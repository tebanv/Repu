package co.repu.r2dbc;

import co.repu.r2dbc.entity.SessionEntity;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface SessionReactiveRepository extends ReactiveCrudRepository<SessionEntity, UUID> {
    Flux<SessionEntity> findByUserIdAndActiveTrue(UUID userId);
    Mono<SessionEntity> findByTokenHash(String tokenHash);
    Mono<Void> deleteByUserIdAndActiveTrue(UUID userId);
    Mono<Void> deleteBySessionId(UUID sessionId);
}
