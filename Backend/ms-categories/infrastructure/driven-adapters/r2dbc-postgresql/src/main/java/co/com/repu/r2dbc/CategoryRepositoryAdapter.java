package co.com.repu.r2dbc;

import co.com.repu.model.category.Category;
import co.com.repu.model.category.gateways.CategoryRepository;
import co.com.repu.r2dbc.entity.CategoryEntity;
import co.com.repu.r2dbc.mapper.CategoryMapper;
import co.com.repu.r2dbc.repository.CategoryReactiveRepository;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
@Slf4j
public class CategoryRepositoryAdapter implements CategoryRepository {

    private final CategoryReactiveRepository repository;
    private final CategoryMapper mapper;

    @Override
    public Flux<Category> findAll() {
        return repository.findAll()
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Category> findById(String id) {
        return repository.findById(UUID.fromString(id))
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Category> save(Category category, String messageId) {

        log.info("llego hasta aca: {}", category);
        CategoryEntity entity = mapper.toEntity(category);

        if (entity.getId() == null) {
            // INSERT: UUID v7
            entity.setId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true);
            log.info("Creando nueva categoría: {}, messageId: {}", entity, messageId);
        } else {
            // UPDATE
            entity.setNew(false);
            log.info("Actualizando categoría: {}, messageId: {}", entity, messageId);
        }

        entity.setUpdatedAt(LocalDateTime.now());

        return repository.save(entity)
                .map(mapper::toDomain)
                .doOnError(e -> log.error("Error persistiendo categoría en BD: {}", e.getMessage()));
    }
}