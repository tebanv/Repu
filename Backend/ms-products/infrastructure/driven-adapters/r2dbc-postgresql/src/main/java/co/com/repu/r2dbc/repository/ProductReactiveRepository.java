package co.com.repu.r2dbc.repository;

import co.com.repu.r2dbc.entity.ProductEntity;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.query.ReactiveQueryByExampleExecutor;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.query.Param;
import reactor.core.publisher.Mono;

import java.util.UUID;

// TODO: This file is just an example, you should delete or modify it
public interface ProductReactiveRepository extends ReactiveCrudRepository<ProductEntity, UUID>, ReactiveQueryByExampleExecutor<Object> {

    @Query("""
            SELECT p.*
            FROM productos p
            INNER JOIN empresas e ON e.id_empresa = p.id_empresa
            WHERE p.id_producto = :productId
              AND e.id_usuario_propietario = :ownerUserId
            """)
    Mono<ProductEntity> findByIdOwnedBy(@Param("productId") UUID productId,
                                        @Param("ownerUserId") UUID ownerUserId);

    @Query("""
            SELECT id_empresa
            FROM empresas
            WHERE id_empresa = :companyId
              AND id_usuario_propietario = :ownerUserId
              AND activo = TRUE
            """)
    Mono<UUID> findActiveCompanyOwnedBy(@Param("companyId") UUID companyId,
                                        @Param("ownerUserId") UUID ownerUserId);

    @Query("""
            SELECT id_empresa
            FROM empresas
            WHERE id_empresa = :companyId
              AND id_usuario_propietario = :ownerUserId
            """)
    Mono<UUID> findCompanyOwnedBy(@Param("companyId") UUID companyId,
                                  @Param("ownerUserId") UUID ownerUserId);

}
