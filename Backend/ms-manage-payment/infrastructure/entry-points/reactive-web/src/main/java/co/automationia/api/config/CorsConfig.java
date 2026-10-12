package co.automationia.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class CorsConfig {

    private static final List<String> ALLOWED_METHODS = List.of(
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
    );

    private static final List<String> ALLOWED_HEADERS = List.of(
            "Content-Type",
            "Authorization",
            "X-Requested-With"
    );

    private static final List<String> EXPOSED_HEADERS = List.of(
            "Content-Type",
            "Authorization"
    );

    @Bean
    public CorsWebFilter corsWebFilter(
            @Value("${cors.allowed-origins:}") String origins
    ) {

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(false);
        config.setAllowedMethods(ALLOWED_METHODS);
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(EXPOSED_HEADERS);
        config.setAllowedOrigins(resolveAllowedOrigins(origins));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsWebFilter(source);
    }


    private List<String> resolveAllowedOrigins(String origins) {
        if (!StringUtils.hasText(origins)) {
            return List.of();
        }

        return Arrays.stream(origins.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
    }
}