package co.com.repu.companies.api.security;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.web.server.context.ServerSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SecurityContextRepository implements ServerSecurityContextRepository {

    private final SessionAuthenticationService sessionAuthenticationService;

    @Override
    public Mono<Void> save(ServerWebExchange exchange, SecurityContext context) {
        throw new UnsupportedOperationException("Stateless API - No session saving");
    }

    @Override
    public Mono<SecurityContext> load(ServerWebExchange exchange) {
        String authorization = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        String bearer = authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring(7)
                : null;

        String cookieValue = exchange.getRequest().getCookies().getFirst(SessionAuthenticationService.SESSION_COOKIE_NAME) == null
                ? null
                : exchange.getRequest().getCookies().getFirst(SessionAuthenticationService.SESSION_COOKIE_NAME).getValue();

        String token = bearer != null ? bearer : cookieValue;
        if (token == null || token.isBlank()) {
            return Mono.empty();
        }

        return sessionAuthenticationService.authenticate(token, bearer != null)
                .map(principal -> new UsernamePasswordAuthenticationToken(
                        principal.userId().toString(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + principal.role()))))
                .map(SecurityContextImpl::new);
    }
}
