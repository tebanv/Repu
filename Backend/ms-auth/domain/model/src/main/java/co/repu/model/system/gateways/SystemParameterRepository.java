package co.repu.model.system.gateways;

import co.repu.model.system.SystemParameter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface SystemParameterRepository {
    Flux<SystemParameter> findAllActive();
    Mono<SystemParameter> findByKey(String key);
    Mono<SystemParameter> save(SystemParameter systemParameter);
}
