package co.com.repu.companies.api.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.core.context.SecurityContext;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityContextRepositoryTest {

    private static final String COOKIE_NAME = "__Host-repu_session";

    @Test
    void shouldLeaveSessionUnauthenticatedWhenUserIdIsMissing() {
        SessionAuthenticationService authenticationService = mock(SessionAuthenticationService.class);
        when(authenticationService.getSessionCookieName()).thenReturn(COOKIE_NAME);
        when(authenticationService.authenticate("session-token", true))
                .thenReturn(Mono.just(new SessionAuthenticationService.SessionPrincipal(
                        null, "DISTRIBUIDOR")));
        SecurityContextRepository repository = new SecurityContextRepository(authenticationService);

        Mono<SecurityContext> context = repository.load(MockServerWebExchange.from(
                MockServerHttpRequest.get("/")
                        .header("Authorization", "Bearer session-token")
                        .build()));

        StepVerifier.create(context).verifyComplete();
    }

    @Test
    void shouldLeaveSessionUnauthenticatedWhenRoleIsMissing() {
        SessionAuthenticationService authenticationService = mock(SessionAuthenticationService.class);
        when(authenticationService.getSessionCookieName()).thenReturn(COOKIE_NAME);
        when(authenticationService.authenticate("session-token", true))
                .thenReturn(Mono.just(new SessionAuthenticationService.SessionPrincipal(
                        UUID.randomUUID(), null)));
        SecurityContextRepository repository = new SecurityContextRepository(authenticationService);

        Mono<SecurityContext> context = repository.load(MockServerWebExchange.from(
                MockServerHttpRequest.get("/")
                        .header("Authorization", "Bearer session-token")
                        .build()));

        StepVerifier.create(context).verifyComplete();
    }

    @Test
    void shouldNotAuthenticateWhenNoTokenIsProvided() {
        SessionAuthenticationService authenticationService = mock(SessionAuthenticationService.class);
        when(authenticationService.getSessionCookieName()).thenReturn(COOKIE_NAME);
        SecurityContextRepository repository = new SecurityContextRepository(authenticationService);

        Mono<SecurityContext> context = repository.load(MockServerWebExchange.from(
                MockServerHttpRequest.get("/").build()));

        StepVerifier.create(context).verifyComplete();
    }
}
