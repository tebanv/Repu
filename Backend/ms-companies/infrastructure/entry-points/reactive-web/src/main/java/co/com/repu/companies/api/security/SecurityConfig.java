package co.com.repu.companies.api.security;

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

                        // 3. Crear empresa solo para ADMIN o DISTRIBUTOR
                        .pathMatchers(HttpMethod.POST, "/api/companies").hasAnyRole("ADMIN", "DISTRIBUTOR", "BUYER")

                        // 4. Actualizar estado solo ADMIN
                        .pathMatchers(HttpMethod.PATCH, "/api/companies/*/status").hasRole("ADMIN")

                        // 5. Todo lo demás requiere estar autenticado (al menos token válido)
                        .anyExchange().authenticated()
                )
                .build();
    }
}
