package co.com.repu.companies.r2dbc.mapper;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class CompanyMapper {

    private final ObjectMapper objectMapper; // Spring Boot ya inyecta Jackson por defecto

    public Company toDomain(CompanyEntity entity) {
        if (entity == null) return null;

        return Company.builder()
                .id(entity.getId())
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
                .operationalConfig(convertJsonStringToObject(entity.getOperationalConfig()))
                .build();
    }

    public CompanyEntity toEntity(Company domain) {
        if (domain == null) return null;

        return CompanyEntity.builder()
                .id(domain.getId())
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
                .operationalConfig(convertObjectToJsonString(domain.getOperationalConfig()))
                .build();
    }

    // --- Helpers para JSONB ---

    private Object convertJsonStringToObject(String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            // Convertimos a Map para flexibilidad en el dominio
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            // Loguear error pero no romper el flujo, o lanzar excepción custom
            return null;
        }
    }

    private String convertObjectToJsonString(Object object) {
        if (object == null) return null;
        try {
            return objectMapper.writeValueAsString(object);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}