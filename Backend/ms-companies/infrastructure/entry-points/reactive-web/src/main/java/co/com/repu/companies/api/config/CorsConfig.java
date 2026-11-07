package co.com.repu.companies.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.server.WebFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    CorsWebFilter corsWebFilter(@Value("${cors.allowed-origins}") String origins) {
        List<String> allowedOrigins = parseOrigins(origins);
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(CorsConfiguration.ALL));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsWebFilter(source);
    }

    @Bean
    WebFilter originValidationWebFilter(
            @Value("${cors.allowed-origins}") String origins,
            @Value("${security.session-cookie.name:__Host-repu_session}") String sessionCookieName) {
        return new OriginValidationWebFilter(parseOrigins(origins), sessionCookieName);
    }

    private List<String> parseOrigins(String origins) {
        List<String> allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::strip)
                .map(origin -> origin.replaceAll("/+$", ""))
                .filter(origin -> !origin.isEmpty())
                .toList();
        if (allowedOrigins.isEmpty() || allowedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "CORS_ALLOWED_ORIGINS debe contener orígenes explícitos; no se permite '*'");
        }
        return allowedOrigins;
    }
}
