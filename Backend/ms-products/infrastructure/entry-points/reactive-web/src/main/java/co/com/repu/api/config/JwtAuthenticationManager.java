package co.com.repu.api.config;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationManager implements ReactiveAuthenticationManager {

    private final JwtProvider jwtProvider;

    @Override
    public Mono<Authentication> authenticate(Authentication authentication) {
        return Mono.just(authentication)
                .map(auth -> (String) auth.getCredentials()) // El token crudo
                .filter(jwtProvider::validate) // Validamos firma y expiración
                .map(token -> {
                    Claims claims = jwtProvider.getClaims(token);
                    String userId = claims.getSubject();
                    String role = claims.get("role", String.class);

                    // Convertimos el rol en una Authority de Spring Security
                    // Asumimos que viene "ADMIN", lo convertimos a "ROLE_ADMIN"
                    List<SimpleGrantedAuthority> authorities = Collections.singletonList(
                            new SimpleGrantedAuthority("ROLE_" + role)
                    );

                    // Retornamos el objeto Authentication exitoso
                    return new UsernamePasswordAuthenticationToken(
                            userId, // Principal (Quién es)
                            token,  // Credenciales
                            authorities // Permisos
                    );
                });
    }
}
