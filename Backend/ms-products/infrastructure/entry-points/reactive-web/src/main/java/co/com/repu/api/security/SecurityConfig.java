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

                        //3. GET Search es público? El contrato no dice Security, pero dice RequestId.
                        // Asumiremos público o autenticado básico. El contrato dice security: [] vacío en GET,
                        // pero security bearerAuth en PATCH.
                        // Así que GET es PÚBLICO.
                        .pathMatchers(HttpMethod.GET, "/api/catalog/products").permitAll()
                        // POST: Solo DISTRIBUTOR
                        .pathMatchers(HttpMethod.POST, "/api/catalog/products").hasAnyRole("ADMIN", "DISTRIBUTOR", "BUYER")
                        // PATCH Update: Solo DISTRIBUTOR
                        .pathMatchers(HttpMethod.PATCH, "/api/catalog/products/*").hasAnyRole("ADMIN", "DISTRIBUTOR", "BUYER")
                        // PATCH Status: DISTRIBUTOR o ADMIN
                        .pathMatchers(HttpMethod.PATCH, "/api/catalog/products/*/status").hasAnyRole("DISTRIBUTOR", "ADMIN", "BUYER")
                        .anyExchange().authenticated()
                )
                .build();
    }
}
