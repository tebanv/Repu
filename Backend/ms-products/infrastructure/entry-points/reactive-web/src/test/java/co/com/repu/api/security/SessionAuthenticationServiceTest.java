package co.com.repu.api.security;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SessionAuthenticationServiceTest {

    @Test
    void shouldTreatRejectedBearerAsUnauthenticatedInsteadOfParsingErrorBody() throws IOException {
        HttpServer server = startSessionServer(401, "{\"message\":\"Sesión inválida o expirada\"}");
        try {
            SessionAuthenticationService service = serviceFor(server);

            SessionAuthenticationService.SessionPrincipal principal =
                    service.authenticate("expired-token", true).block(Duration.ofSeconds(2));

            assertNull(principal);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void shouldTreatSuccessfulButIncompleteSessionAsUnauthenticated() throws IOException {
        HttpServer server = startSessionServer(200, "{\"role\":\"COMPRADOR\"}");
        try {
            SessionAuthenticationService service = serviceFor(server);

            SessionAuthenticationService.SessionPrincipal principal =
                    service.authenticate("token", true).block(Duration.ofSeconds(2));

            assertNull(principal);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void shouldSurfaceAuthenticationServiceFailuresInsteadOfTreatingThemAsExpiredSessions() throws IOException {
        HttpServer server = startSessionServer(503, "{\"message\":\"Unavailable\"}");
        try {
            SessionAuthenticationService service = serviceFor(server);

            assertThrows(WebClientResponseException.class,
                    () -> service.authenticate("token", true).block(Duration.ofSeconds(2)));
        } finally {
            server.stop(0);
        }
    }

    private HttpServer startSessionServer(int status, String body) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/auth/session", exchange -> {
            byte[] response = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, response.length);
            try (var responseBody = exchange.getResponseBody()) {
                responseBody.write(response);
            }
        });
        server.start();
        return server;
    }

    private SessionAuthenticationService serviceFor(HttpServer server) {
        return new SessionAuthenticationService(
                "http://127.0.0.1:" + server.getAddress().getPort(), "", "session");
    }
}
