package co.repu.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OriginValidationWebFilterTest {

    private final OriginValidationWebFilter filter = new OriginValidationWebFilter(
            List.of("https://app.repu.com"), "__Host-repu_session");

    @Test
    void rejectsUntrustedOriginOnStateChangingRequest() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest
                .method(HttpMethod.PATCH, "/api/resource")
                .header("Origin", "https://evil.example")
                .build());
        AtomicBoolean chainCalled = new AtomicBoolean();

        filter.filter(exchange, ignored -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertEquals(HttpStatus.FORBIDDEN, exchange.getResponse().getStatusCode());
        assertFalse(chainCalled.get());
    }

    @Test
    void allowsTrustedOriginAndRequiresOriginForCookieMutation() {
        var trustedExchange = MockServerWebExchange.from(MockServerHttpRequest
                .method(HttpMethod.POST, "/api/resource")
                .header("Origin", "https://app.repu.com")
                .build());
        AtomicBoolean trustedChainCalled = new AtomicBoolean();
        filter.filter(trustedExchange, ignored -> {
            trustedChainCalled.set(true);
            return Mono.empty();
        }).block();

        var cookieExchange = MockServerWebExchange.from(MockServerHttpRequest
                .method(HttpMethod.PATCH, "/api/resource")
                .cookie(new HttpCookie("__Host-repu_session", "session"))
                .build());
        AtomicBoolean cookieChainCalled = new AtomicBoolean();
        filter.filter(cookieExchange, ignored -> {
            cookieChainCalled.set(true);
            return Mono.empty();
        }).block();

        assertTrue(trustedChainCalled.get());
        assertEquals(HttpStatus.FORBIDDEN, cookieExchange.getResponse().getStatusCode());
        assertFalse(cookieChainCalled.get());
    }
}
