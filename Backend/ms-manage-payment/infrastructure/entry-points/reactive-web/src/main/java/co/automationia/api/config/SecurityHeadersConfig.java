package co.automationia.api.config;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
public class SecurityHeadersConfig implements WebFilter {

    private static final String CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

    private static final String CONTENT_SECURITY_POLICY =
            "default-src 'self'; " +
                    "frame-ancestors 'self'; " +
                    "form-action 'self'";

    private static final String REFERRER_POLICY =
            "strict-origin-when-cross-origin";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {

        HttpHeaders headers = exchange.getResponse().getHeaders();

        applySecurityHeaders(headers);

        return chain.filter(exchange);
    }

    private void applySecurityHeaders(HttpHeaders headers) {
        headers.set(CONTENT_SECURITY_POLICY_HEADER, CONTENT_SECURITY_POLICY);
        headers.set(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0");
        headers.set("Pragma", "no-cache");
        headers.set("Referrer-Policy", REFERRER_POLICY);

        headers.remove(HttpHeaders.SERVER);
    }
}
