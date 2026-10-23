package co.com.repu.r2dbc;

import co.com.repu.model.category.Category;
import co.com.repu.model.category.PersistenceException;
import co.com.repu.model.category.gateways.CategoryRepository;
import co.com.repu.r2dbc.entity.CategoryEntity;
import co.com.repu.r2dbc.mapper.CategoryMapper;
import co.com.repu.r2dbc.repository.CategoryReactiveRepository;
import com.github.f4b6a3.uuid.UuidCreator;
import io.r2dbc.spi.R2dbcException;
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
                .onErrorMap(this::translatePersistenceError)
                .doOnError(e -> log.error("Error persistiendo categoría, messageId: {}", messageId, e));
    }

    private Throwable translatePersistenceError(Throwable error) {
        R2dbcException databaseError = findR2dbcException(error);
        if (databaseError == null) {
            return error;
        }

        String sqlState = databaseError.getSqlState();
        if ("23505".equals(sqlState)) {
            return new PersistenceException(PersistenceException.Kind.DUPLICATE, error);
        }
        if ("23503".equals(sqlState)) {
            return new PersistenceException(PersistenceException.Kind.INVALID_REFERENCE, error);
        }
        if ("23514".equals(sqlState) || "23502".equals(sqlState)
                || (sqlState != null && sqlState.startsWith("22"))) {
            return new PersistenceException(PersistenceException.Kind.INVALID_VALUE, error);
        }
        if (sqlState != null && sqlState.startsWith("08")) {
            return new PersistenceException(PersistenceException.Kind.UNAVAILABLE, error);
        }
        return error;
    }

    private R2dbcException findR2dbcException(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof R2dbcException r2dbcException) {
                return r2dbcException;
            }
            current = current.getCause();
        }
        return null;
    }
}