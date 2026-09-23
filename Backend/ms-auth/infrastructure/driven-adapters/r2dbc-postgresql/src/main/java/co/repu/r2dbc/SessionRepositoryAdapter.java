
package co.repu.r2dbc;

import co.repu.model.users.Session;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.r2dbc.entity.SessionEntity;
import co.repu.r2dbc.mapper.SessionMapper;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class SessionRepositoryAdapter implements UserSessionRepository {

    private final SessionReactiveRepository sessionReactiveRepository;
    private final SessionMapper mapper;

    @Override
    public Mono<Session> save(Session session) {
        SessionEntity entity = mapper.toEntity(session);
        if (entity.getSessionId() == null) {
            entity.setSessionId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true);
        }
        if (entity.getActive() == null) {
            entity.setActive(true);
        }
        entity.setLastAccess(LocalDateTime.now());
        return sessionReactiveRepository.save(entity)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Session> findByTokenHash(String tokenHash) {
        return sessionReactiveRepository.findByTokenHash(tokenHash)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Session> findBySessionId(UUID sessionId) {
        return sessionReactiveRepository.findById(sessionId)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Session> touch(Session session) {
        session.setLastAccess(LocalDateTime.now());
        return saveExisting(session);
    }

    @Override
    public Flux<Session> findActiveByUserId(UUID userId) {
        return sessionReactiveRepository.findByUserIdAndActiveTrue(userId)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Void> deactivateAllByUserId(UUID userId) {
        return sessionReactiveRepository.findByUserIdAndActiveTrue(userId)
                .flatMap(session -> {
                    session.setActive(false);
                    session.setLastAccess(LocalDateTime.now());
                    return sessionReactiveRepository.save(session);
                })
                .then();
    }

    @Override
    public Mono<Void> deactivateBySessionId(UUID sessionId) {
        return sessionReactiveRepository.findById(sessionId)
                .flatMap(session -> {
                    session.setActive(false);
                    session.setLastAccess(LocalDateTime.now());
                    return sessionReactiveRepository.save(session);
                })
                .then();
    }

    private Mono<Session> saveExisting(Session session) {
        SessionEntity entity = mapper.toEntity(session);
        entity.setNew(false);
        return sessionReactiveRepository.save(entity).map(mapper::toDomain);
    }
}
