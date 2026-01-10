package co.com.repu.r2dbc.mapper;


import co.com.repu.model.user.User;
import co.com.repu.r2dbc.entity.UserEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class UserMapper {


    private final ObjectMapper objectMapper;

    public User toDomain(UserEntity data) {
        if (data == null) return null;

        return User.builder()
                .id(data.getId())
                .name(data.getName())
                .lastName(data.getLastName())
                .email(data.getEmail())
                .numberMobile(data.getNumberMobile())
                .password(data.getPassword())
                .role(data.getRole())
                .status(data.getStatus())
                .attributesUser(convertJsonToObject(data.getAttributesUser()))
                .lastLogin(data.getLastLogin())
                .createdAt(data.getCreatedAt())
                .updatedAt(data.getUpdatedAt())
                .build();
    }


    public UserEntity toEntity(User domain) {
        if (domain == null) return null;

        return UserEntity.builder()
                .id(domain.getId())
                .name(domain.getName())
                .lastName(domain.getLastName())
                .email(domain.getEmail())
                .numberMobile(domain.getNumberMobile())
                .password(domain.getPassword())
                .role(domain.getRole())
                .status(domain.getStatus())
                .attributesUser(convertObjectToJson(domain.getAttributesUser()))
                .lastLogin(domain.getLastLogin())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    // --- Helpers para JSONB ---

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
