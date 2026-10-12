package co.com.repu.r2dbc;

import co.com.repu.model.product.Product;
import co.com.repu.model.product.gateways.ProductRepository;
import co.com.repu.r2dbc.entity.ProductEntity;
import co.com.repu.r2dbc.mapper.ProductMapper;
import co.com.repu.r2dbc.repository.ProductReactiveRepository;
import com.github.f4b6a3.uuid.UuidCreator;
import io.r2dbc.postgresql.codec.Json;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
@Slf4j
public class ProductRepositoryAdapter implements ProductRepository {

    private final ProductReactiveRepository repository; // CRUD básico
    private final DatabaseClient databaseClient;        // Para consultas dinámicas complejas
    private final ProductMapper mapper;

    @Override
    public Mono<Product> save(Product product, String messageId) {
        ProductEntity entity = mapper.toEntity(product);
        if (entity.getId() == null) {
            entity.setId(UuidCreator.getTimeOrderedEpoch()); // UUID v7
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true);
            log.info("Entidad a guardar: {}, messageId: {}", entity, messageId);
        } else {
            entity.setNew(false);
            log.info("Entidad a actualizar: {}, messageId: {}", entity, messageId);
        }
        entity.setUpdatedAt(LocalDateTime.now());
        return repository.save(entity).map(mapper::toDomain);
    }

    @Override
    public Mono<Product> findById(String id) {
        return repository.findById(UUID.fromString(id)).map(mapper::toDomain);
    }

    @Override
    public Flux<Product> searchProducts(String companyId, String categoryId, String attributesJsonStr) {

        // CONSTRUCCIÓN DINÁMICA DE SQL
        StringBuilder sql = new StringBuilder("SELECT * FROM productos " +
                                                "WHERE id_empresa = :companyId");

        if (categoryId != null) {
            sql.append(" AND id_categoria = :categoryId");
        }

        // Magia JSONB de Postgres: El operador @> verifica si el JSON de la BD contiene al JSON del filtro
        if (attributesJsonStr != null && !attributesJsonStr.isEmpty()) {
            sql.append(" AND caracteristicas_tecnicas @> :attributes::jsonb");
        }
// Ejecución
        DatabaseClient.GenericExecuteSpec spec = databaseClient.sql(sql.toString())
                .bind("companyId", UUID.fromString(companyId));

        if (categoryId != null) {
            spec = spec.bind("categoryId", UUID.fromString(categoryId));
        }
        if (attributesJsonStr != null && !attributesJsonStr.isEmpty()) {
            spec = spec.bind("attributes", Json.of(attributesJsonStr));
        }

        // MAPEO MANUAL DE ALTO RENDIMIENTO (Sin ir otra vez a la BD)
        return spec.map(row -> ProductEntity.builder()
                        .id(row.get("id_producto", UUID.class))
                        .companyId(row.get("id_empresa", UUID.class))
                        .categoryId(row.get("id_categoria", UUID.class))
                        .name(row.get("nombre", String.class))
                        .sku(row.get("sku_referencia", String.class))
                        .description(row.get("descripcion_corta", String.class))
                        .price(row.get("precio_base", java.math.BigDecimal.class))
                        .priceOffer(row.get("precio_oferta", java.math.BigDecimal.class))
                        .stock(row.get("inventario_disponible", Integer.class))
                        .attributes(row.get("caracteristicas_tecnicas", Json.class))
                        .images(row.get("imagenes_urls", Json.class))
                        .active(row.get("activo", Boolean.class))
                        .createdAt(row.get("fecha_creacion", java.time.LocalDateTime.class))
                        .updatedAt(row.get("fecha_actualizacion", java.time.LocalDateTime.class))
                        .build()
                )
                .all() // Convertimos a Flux<ProductEntity>
                .map(mapper::toDomain);
    }
}