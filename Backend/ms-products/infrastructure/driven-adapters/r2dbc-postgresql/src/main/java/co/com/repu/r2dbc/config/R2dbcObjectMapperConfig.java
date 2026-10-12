package co.com.repu.r2dbc.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class R2dbcObjectMapperConfig {

    @Bean
    public ObjectMapper r2dbcObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // 1. Módulo para soportar LocalDateTime, LocalDate, etc.
        // Sin esto, te dará error al mapear 'createdAt' o 'lastLogin'
        mapper.registerModule(new JavaTimeModule());

        // 2. No escribir fechas como timestamps numéricos (usar ISO-8601 string)
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // 3. Robustez: Si la BD trae un campo nuevo que Java no conoce, no fallar
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        return mapper;
    }
}
