package co.repu.r2dbc;

import co.repu.model.system.SystemParameter;
import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.r2dbc.entity.SystemParameterEntity;
import co.repu.r2dbc.mapper.SystemParameterMapper;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
@RequiredArgsConstructor
public class SystemParameterRepositoryAdapter implements SystemParameterRepository {

    private final SystemParameterReactiveRepository repository;
    private final SystemParameterMapper mapper;

    @Override
    public Flux<SystemParameter> findAllActive() {
        return repository.findAllByActiveTrue()
                .map(mapper::toDomain);
    }

    @Override
    public Mono<SystemParameter> findByKey(String key) {
        return repository.findByKey(key)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<SystemParameter> save(SystemParameter systemParameter) {
        SystemParameterEntity entity = mapper.toEntity(systemParameter);
        if (entity.getId() == null) {
            entity.setId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true);
        }
        entity.setUpdatedAt(LocalDateTime.now());
        if (entity.getActive() == null) {
            entity.setActive(true);
        }
        return repository.save(entity)
                .map(mapper::toDomain);
    }
}
