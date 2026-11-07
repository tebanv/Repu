package co.com.bancolombia.api.config;

import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Set;

public class OriginValidationWebFilter implements WebFilter {

    private static final Set<HttpMethod> STATE_CHANGING_METHODS =
            Set.of(HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE);
    private final List<String> allowedOrigins;
    private final String sessionCookieName;

    public OriginValidationWebFilter(List<String> allowedOrigins, String sessionCookieName) {
        this.allowedOrigins = List.copyOf(allowedOrigins);
        this.sessionCookieName = sessionCookieName;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String origin = exchange.getRequest().getHeaders().getOrigin();
        boolean stateChanging = STATE_CHANGING_METHODS.contains(exchange.getRequest().getMethod());
        boolean sessionCookiePresent = exchange.getRequest().getCookies().containsKey(sessionCookieName);
        String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
        boolean bearerAuthentication = authorization != null && authorization.startsWith("Bearer ");
        if (stateChanging && ((origin != null && !allowedOrigins.contains(origin))
                || (sessionCookiePresent && !bearerAuthentication && origin == null))) {
            exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
            return exchange.getResponse().setComplete();
        }
        return chain.filter(exchange);
    }
}
