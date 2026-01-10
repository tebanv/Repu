package co.com.repu.companies.r2dbc.mapper;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CompanyMapper {

    private final ObjectMapper objectMapper; // Spring Boot ya inyecta Jackson por defecto

    public Company toDomain(CompanyEntity entity) {
        if (entity == null) return null;

        return Company.builder()
                .id(entity.getId() != null ? entity.getId().toString() : null)
                .userIdOwner(entity.getUserIdOwner())
                .name(entity.getName())
                .taxId(entity.getTaxId())
                .logoUrl(entity.getLogoUrl())
                .description(entity.getDescription())
                .address(entity.getAddress())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .rating(entity.getRating())
                .active(entity.getActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .operationalConfig(convertJsonToObject(entity.getOperationalConfig()))
                .build();
    }

    public CompanyEntity toEntity(Company domain) {
        if (domain == null) return null;

        return CompanyEntity.builder()
                .id(domain.getId() != null ? UUID.fromString(domain.getId()) : null)
                .userIdOwner(domain.getUserIdOwner())
                .name(domain.getName())
                .taxId(domain.getTaxId())
                .logoUrl(domain.getLogoUrl())
                .description(domain.getDescription())
                .address(domain.getAddress())
                .latitude(domain.getLatitude())
                .longitude(domain.getLongitude())
                .rating(domain.getRating())
                .active(domain.getActive())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .operationalConfig(convertObjectToJson(domain.getOperationalConfig()))
                .build();
    }

    // --- Helpers para JSONB ---

    private Object convertJsonToObject(Json json) {
        if (json == null) return null;
        try {
            // json.asString() obtiene el string crudo de la BD
            return objectMapper.readValue(json.asString(), Map.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Json convertObjectToJson(Object object) {
        if (object == null) return Json.of("{}"); // JSON vacío por defecto
        try {
            String jsonString = objectMapper.writeValueAsString(object);
            return Json.of(jsonString); // <--- Aquí ocurre la magia para Postgres
        } catch (JsonProcessingException e) {
            return Json.of("{}");
        }
    }
}