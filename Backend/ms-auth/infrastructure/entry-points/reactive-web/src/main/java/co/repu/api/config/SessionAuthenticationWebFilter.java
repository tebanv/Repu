package co.repu.api.config;

import co.repu.api.Handler;
import co.repu.model.users.User;
import co.repu.model.users.AuthSession;
import co.repu.usecase.auth.AuthUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
@RequiredArgsConstructor
@Log4j2
public class SessionAuthenticationWebFilter implements WebFilter {

    private final AuthUseCase authUseCase;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (isPublic(path) || "OPTIONS".equals(exchange.getRequest().getMethod().name())) {
            return chain.filter(exchange);
        }

        String token = extractToken(exchange);
        if (token == null || token.isBlank()) {
            log.warn("Solicitud no autenticada rechazada para {}", path);
            return reject(exchange, "Sesión requerida");
        }

        return authUseCase.authenticateSessionDetails(token)
                .flatMap(context -> continueWithContext(exchange, chain, context))
                .onErrorResume(error -> {
                    log.warn("Sesión rechazada para {}: {}", path, error.getMessage());
                    return reject(exchange, "Sesión inválida o expirada");
                });
    }

    private Mono<Void> continueWithContext(ServerWebExchange exchange, WebFilterChain chain, AuthSession context) {
        User user = context.getUser();
        var authentication = new UsernamePasswordAuthenticationToken(
                user.getId().toString(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole())));
        log.debug("Sesión autenticada para usuario {} con rol {}", user.getId(), user.getRole());
        ServerWebExchange authenticatedExchange = exchange.mutate()
                .request(builder -> {
                    builder.header("X-User-Id", user.getId().toString());
                    if (context.getSession().getActiveCompanyId() != null) {
                        builder.header("X-Company-Id", context.getSession().getActiveCompanyId().toString());
                    }
                })
                .build();
        return chain.filter(authenticatedExchange)
                .contextWrite(ReactiveSecurityContextHolder.withSecurityContext(
                        Mono.just(new SecurityContextImpl(authentication))));
    }

    private String extractToken(ServerWebExchange exchange) {
        String authorization = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        var cookie = exchange.getRequest().getCookies().getFirst(Handler.SESSION_COOKIE);
        return cookie == null ? null : cookie.getValue();
    }

    private boolean isPublic(String path) {
        return path.endsWith("/api/auth/login")
                || path.endsWith("/api/auth/register");
    }

    private Mono<Void> reject(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add(HttpHeaders.CONTENT_TYPE, "application/json");
        byte[] body = ("{\"message\":\"" + message + "\"}").getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return exchange.getResponse().writeWith(Mono.just(
                exchange.getResponse().bufferFactory().wrap(body)));
    }
}
