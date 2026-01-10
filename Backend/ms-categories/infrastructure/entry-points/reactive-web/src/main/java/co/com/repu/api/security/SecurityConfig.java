package co.com.repu.api.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final SecurityContextRepository securityContextRepository;

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable) // Microservicios no usan CSRF
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)

                // Configurar nuestro repositorio de contexto (que lee el token)
                .authenticationManager(null) // Lo manejamos manual en el repo
                .securityContextRepository(securityContextRepository)

                .authorizeExchange(exchanges -> exchanges
                        // 1. Endpoints Públicos (Si quieres que listar sea público, descomenta)
                        // .pathMatchers(HttpMethod.GET, "/companies").permitAll()

                        // 2. Swagger / Actuator (Salud)
                        .pathMatchers("/actuator/**").permitAll()
                        .pathMatchers("/webjars/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()

                        // 3. GET público (para que todos vean el menú)
                        .pathMatchers(HttpMethod.GET, "/api/catalog/categories").permitAll()
                        .pathMatchers(HttpMethod.POST, "/api/catalog/categories").hasAnyRole("ADMIN", "ANALYST", "BUYER")
                        .pathMatchers(HttpMethod.PATCH, "/api/catalog/categories/*").hasAnyRole("ADMIN", "ANALYST", "BUYER")
                        .pathMatchers(HttpMethod.PATCH, "/api/catalog/categories/*/status").hasAnyRole("ADMIN", "ANALYST", "BUYER")

                        .anyExchange().authenticated()
                )
                .build();
    }
}
