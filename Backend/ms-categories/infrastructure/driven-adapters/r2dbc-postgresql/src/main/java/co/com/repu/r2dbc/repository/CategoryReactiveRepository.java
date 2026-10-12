package co.com.repu.r2dbc.repository;

import co.com.repu.r2dbc.entity.CategoryEntity;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CategoryReactiveRepository extends ReactiveCrudRepository<CategoryEntity, UUID> {
    // Aquí podríamos agregar métodos custom si quisieras buscar por padre:
    // Flux<CategoryEntity> findByParentId(UUID parentId);
}
