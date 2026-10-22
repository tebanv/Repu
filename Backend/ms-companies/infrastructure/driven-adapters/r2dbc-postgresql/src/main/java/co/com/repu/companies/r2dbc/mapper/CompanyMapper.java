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

    private final ObjectMapper objectMapper;

    public Company toDomain(CompanyEntity entity) {
        if (entity == null) return null;

        return Company.builder()
                .id(entity.getId() != null ? entity.getId().toString() : null)
                .userIdOwner(entity.getUserIdOwner())
                .name(entity.getName())
                .taxId(entity.getTaxId())
                .logoUrl(entity.getLogoUrl())
                .description(entity.getDescription())
                .phone(entity.getPhone())
                .bannerUrl(entity.getBannerUrl())
                .slug(entity.getSlug())
                .address(entity.getAddress())
                .latitude(entity.getLatitude())
                .longitude(entity.getLongitude())
                .rating(entity.getRating())
                .reviewCount(entity.getReviewCount())
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
                .phone(domain.getPhone())
                .bannerUrl(domain.getBannerUrl())
                .slug(domain.getSlug())
                .address(domain.getAddress())
                .latitude(domain.getLatitude())
                .longitude(domain.getLongitude())
                .rating(domain.getRating())
                .reviewCount(domain.getReviewCount())
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
            return objectMapper.readValue(json.asString(), Map.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Company operationalConfig contains invalid JSON", e);
        }
    }

    private Json convertObjectToJson(Object object) {
        return toJson(object);
    }

    public Json toJson(Object object) {
        if (object == null) return Json.of("{}");
        try {
            String jsonString = objectMapper.writeValueAsString(object);
            return Json.of(jsonString);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Company operationalConfig cannot be serialized", e);
        }
    }
}