package co.com.bancolombia.api.config;

import co.com.bancolombia.model.auth.AuthenticatedUser;
import co.com.bancolombia.model.auth.SessionCredential;
import co.com.bancolombia.model.auth.gateways.SessionAuthenticationGateway;
import co.com.bancolombia.model.order.OrderException;
import org.springframework.http.HttpCookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SessionAuthenticationWebFilterCartTest {
    private static final String COOKIE_NAME = "__Host-repu_session";

    @Test
    void rejectsBearerOnlyCartRequestsWithoutCallingAuthService() {
        SessionAuthenticationGateway gateway = mock(SessionAuthenticationGateway.class);
        SessionAuthenticationWebFilter filter = new SessionAuthenticationWebFilter(gateway, COOKIE_NAME);
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/ms-orders/api/cart")
                .header("Authorization", "Bearer opaque-token"));

        StepVerifier.create(filter.filter(exchange, ignored -> Mono.empty()))
                .expectErrorSatisfies(error -> {
                    OrderException exception = (OrderException) error;
                    assertEquals("UNAUTHENTICATED", exception.code());
                })
                .verify();

        verifyNoInteractions(gateway);
    }

    @Test
    void prefersCookieAndAllowsBuyerForCartRequests() {
        SessionAuthenticationGateway gateway = mock(SessionAuthenticationGateway.class);
        when(gateway.authenticate(eq(new SessionCredential("cookie-token", SessionCredential.Type.COOKIE)),
                anyString())).thenReturn(Mono.just(new AuthenticatedUser(UUID.randomUUID(), "COMPRADOR")));
        SessionAuthenticationWebFilter filter = new SessionAuthenticationWebFilter(gateway, COOKIE_NAME);
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/ms-orders/api/cart")
                .cookie(new HttpCookie(COOKIE_NAME, "cookie-token"))
                .header("Authorization", "Bearer ignored-token"));

        StepVerifier.create(filter.filter(exchange, ignored -> Mono.empty()))
                .verifyComplete();

        verify(gateway).authenticate(
                eq(new SessionCredential("cookie-token", SessionCredential.Type.COOKIE)), anyString());
    }

    @Test
    void rejectsNonBuyerCartRequests() {
        SessionAuthenticationGateway gateway = mock(SessionAuthenticationGateway.class);
        when(gateway.authenticate(any(), anyString()))
                .thenReturn(Mono.just(new AuthenticatedUser(UUID.randomUUID(), "DISTRIBUIDOR")));
        SessionAuthenticationWebFilter filter = new SessionAuthenticationWebFilter(gateway, COOKIE_NAME);
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/ms-orders/api/cart")
                .cookie(new HttpCookie(COOKIE_NAME, "distributor-session")));

        StepVerifier.create(filter.filter(exchange, ignored -> Mono.empty()))
                .expectErrorSatisfies(error -> {
                    OrderException exception = (OrderException) error;
                    assertEquals("FORBIDDEN", exception.code());
                    assertEquals(403, exception.status());
                })
                .verify();
    }
}
