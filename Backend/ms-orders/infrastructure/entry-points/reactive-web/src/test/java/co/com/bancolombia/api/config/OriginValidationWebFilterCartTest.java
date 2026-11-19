package co.com.bancolombia.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OriginValidationWebFilterCartTest {
    @Test
    void bearerHeaderDoesNotBypassOriginCheckForCookieOnlyCartEndpoint() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest
                .post("/ms-orders/api/cart/items")
                .cookie(new HttpCookie("__Host-repu_session", "cookie-token"))
                .header("Authorization", "Bearer bearer-token"));
        var filter = new OriginValidationWebFilter(List.of("https://app.repu.com"), "__Host-repu_session");

        StepVerifier.create(filter.filter(exchange, ignored -> Mono.error(
                        new AssertionError("Rejected request must not reach the handler"))))
                .verifyComplete();

        assertEquals(HttpStatus.FORBIDDEN, exchange.getResponse().getStatusCode());
    }
}
