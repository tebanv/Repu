package co.repu.r2dbc.mapper;

import co.repu.model.system.SystemParameter;
import co.repu.r2dbc.entity.SystemParameterEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class SystemParameterMapper {

    private final ObjectMapper objectMapper;

    public SystemParameter toDomain(SystemParameterEntity data) {
        if (data == null) {
            return null;
        }
        return SystemParameter.builder()
                .id(data.getId())
                .key(data.getKey())
                .configValue(convertJsonToObject(data.getConfigValue()))
                .description(data.getDescription())
                .active(data.getActive())
                .createdAt(data.getCreatedAt())
                .updatedAt(data.getUpdatedAt())
                .build();
    }

    public SystemParameterEntity toEntity(SystemParameter domain) {
        if (domain == null) {
            return null;
        }
        return SystemParameterEntity.builder()
                .id(domain.getId())
                .key(domain.getKey())
                .configValue(convertObjectToJson(domain.getConfigValue()))
                .description(domain.getDescription())
                .active(domain.getActive())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    private Object convertJsonToObject(Json json) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json.asString(), Map.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Json convertObjectToJson(Object object) {
        if (object == null) {
            return Json.of("{} ");
        }
        try {
            return Json.of(objectMapper.writeValueAsString(object));
        } catch (JsonProcessingException e) {
            return Json.of("{} ");
        }
    }
}
