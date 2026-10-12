package co.repu.r2dbc;

import co.repu.r2dbc.entity.SystemParameterEntity;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface SystemParameterReactiveRepository extends ReactiveCrudRepository<SystemParameterEntity, UUID> {
    Mono<SystemParameterEntity> findByKey(String key);
    Flux<SystemParameterEntity> findAllByActiveTrue();
}