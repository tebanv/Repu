package co.com.repu.r2dbc.mapper;

import co.com.repu.model.product.Product;
import co.com.repu.r2dbc.entity.ProductEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProductMapper {

    private final ObjectMapper objectMapper;

    public Product toDomain(ProductEntity entity) {
        if (entity == null) return null;

        return Product.builder()
                .id(entity.getId() != null ? entity.getId().toString() : null)
                .companyId(entity.getCompanyId().toString())
                .categoryId(entity.getCategoryId().toString())
                .name(entity.getName())
                .sku(Integer.valueOf(entity.getSku()))
                .description(entity.getDescription())
                .price(entity.getPrice())
                .priceOffer(entity.getPriceOffer())
                .stock(entity.getStock())
                .active(entity.getActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .attributes(jsonToMap(entity.getAttributes()))
                .images(jsonToList(entity.getImages()))
                .build();
    }

    public ProductEntity toEntity(Product domain) {
        if (domain == null) return null;

        return ProductEntity.builder()
                .id(domain.getId() != null ? UUID.fromString(domain.getId()) : null)
                .companyId(UUID.fromString(domain.getCompanyId()))
                .categoryId(UUID.fromString(domain.getCategoryId()))
                .name(domain.getName())
                .sku(String.valueOf(domain.getSku()))
                .description(domain.getDescription())
                .price(domain.getPrice())
                .priceOffer(domain.getPriceOffer())
                .stock(domain.getStock())
                .attributes(toJson(domain.getAttributes()))
                .images(toJson(domain.getImages()))
                .active(domain.getActive())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    // --- Helpers para JSONB ---
    // Helper 1: Para Atributos (Devuelve Map o Object)
    private Object jsonToMap(Json json) {
        if (json == null) return null;
        try {
            // Lee como Map genérico
            return objectMapper.readValue(json.asString(), Map.class);
        } catch (JsonProcessingException e) {
            // Loguear error si es necesario
            return null;
        }
    }

    // Helper 2: Para Imágenes (Devuelve List<String>)
    private List<String> jsonToList(Json json) {
        if (json == null) return Collections.emptyList(); // Mejor lista vacía que null
        try {
            // Lee explícitamente como una Lista de Strings
            return objectMapper.readValue(json.asString(), new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }

    // Helper 3: Escritura Genérica (Sirve para ambos)
    private Json toJson(Object source) {
        if (source == null) return Json.of("null"); // O Json.of("{}") o Json.of("[]") según prefieras
        try {
            return Json.of(objectMapper.writeValueAsString(source));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Error serializando JSON", e);
        }
    }

    private Object convertJsonToObject(Json json) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json.asString(), Map.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Json convertObjectToJson(Object object) {
        if (object == null) return Json.of("{}");
        try {
            String jsonString = objectMapper.writeValueAsString(object);
            return Json.of(jsonString);
        } catch (JsonProcessingException e) {
            return Json.of("{}");
        }
    }
}