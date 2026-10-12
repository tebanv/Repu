package co.com.repu.api.security;

import co.com.repu.r2dbc.SessionAuthenticationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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
        String token = authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring(7)
                : exchange.getRequest().getCookies().getFirst("__Host-repu_session") == null
                ? null
                : exchange.getRequest().getCookies().getFirst("__Host-repu_session").getValue();

        return sessionAuthenticationService.authenticate(token)
                .map(principal -> new UsernamePasswordAuthenticationToken(
                        principal.userId().toString(), null,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "ROLE_" + principal.role()))))
                .map(SecurityContextImpl::new);
    }
}
