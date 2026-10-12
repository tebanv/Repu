package co.com.bancolombia.api.config;

import co.com.bancolombia.model.auth.gateways.SessionAuthenticationGateway;
import co.com.bancolombia.model.auth.SessionCredential;
import co.com.bancolombia.model.order.OrderException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
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
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SessionAuthenticationWebFilter implements WebFilter {
    private static final String SESSION_COOKIE = "__Host-repu_session";
    private final SessionAuthenticationGateway sessionAuthenticationGateway;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (isOptionsRequest(exchange) || isHealthCheck(exchange)) {
            return chain.filter(exchange);
        }

        SessionCredential credential = extractSessionCredential(exchange);
        if (credential == null || credential.value().isBlank()) {
            return Mono.error(unauthenticated());
        }

        String requestId = exchange.getRequest().getHeaders().getFirst("X-Request-ID");
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }
        return sessionAuthenticationGateway.authenticate(credential, requestId)
                .switchIfEmpty(Mono.error(unauthenticated()))
                .flatMap(user -> {
                    var authentication = new UsernamePasswordAuthenticationToken(
                            user.userId().toString(),
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
                    return chain.filter(exchange)
                            .contextWrite(ReactiveSecurityContextHolder.withSecurityContext(
                                    Mono.just(new SecurityContextImpl(authentication))));
                });
    }

    private SessionCredential extractSessionCredential(ServerWebExchange exchange) {
        String authorization = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            if (authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
                return new SessionCredential(authorization.substring(7).trim(), SessionCredential.Type.BEARER);
            }
            return null;
        }
        var cookie = exchange.getRequest().getCookies().getFirst(SESSION_COOKIE);
        return cookie == null ? null : new SessionCredential(cookie.getValue(), SessionCredential.Type.COOKIE);
    }

    private boolean isOptionsRequest(ServerWebExchange exchange) {
        return exchange.getRequest().getMethod() == org.springframework.http.HttpMethod.OPTIONS;
    }

    private boolean isHealthCheck(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        return path.equals("/actuator/health") || path.endsWith("/actuator/health")
                || path.endsWith("/actuator/health/liveness") || path.endsWith("/actuator/health/readiness");
    }

    private OrderException unauthenticated() {
        return new OrderException("UNAUTHENTICATED", "Se requiere una sesión autenticada.", 401);
    }
}
