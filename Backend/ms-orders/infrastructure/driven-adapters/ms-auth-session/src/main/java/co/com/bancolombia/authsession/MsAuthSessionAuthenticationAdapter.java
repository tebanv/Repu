package co.com.bancolombia.authsession;

import co.com.bancolombia.model.auth.AuthenticatedUser;
import co.com.bancolombia.model.auth.SessionCredential;
import co.com.bancolombia.model.auth.gateways.SessionAuthenticationGateway;
import co.com.bancolombia.model.order.OrderException;
import io.netty.channel.ChannelOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.net.URI;
import java.time.Duration;
import java.util.UUID;

@Component
public class MsAuthSessionAuthenticationAdapter implements SessionAuthenticationGateway {
    private static final String SESSION_COOKIE = "__Host-repu_session";
    private final WebClient webClient;

    public MsAuthSessionAuthenticationAdapter(@Value("${auth.session.base-url}") String baseUrl,
                                              @Value("${auth.session.allow-insecure-http:false}") boolean allowInsecureHttp,
                                              @Value("${auth.session.connect-timeout}") Duration connectTimeout,
                                              @Value("${auth.session.response-timeout}") Duration responseTimeout,
                                              @Value("${auth.session.service-token:}") String serviceToken) {
        validateBaseUrl(baseUrl, allowInsecureHttp);
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, Math.toIntExact(connectTimeout.toMillis()))
                .responseTimeout(responseTimeout);
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeaders(headers -> {
                    if (serviceToken != null && !serviceToken.isBlank()) {
                        headers.set("X-Auth-Service-Token", serviceToken);
                    }
                })
                .build();
    }

    @Override
    public Mono<AuthenticatedUser> authenticate(SessionCredential credential, String requestId) {
        WebClient.RequestHeadersSpec<?> request = webClient.get()
                .uri("/api/auth/session")
                .header("X-Request-ID", requestId);
        if (credential.type() == SessionCredential.Type.BEARER) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + credential.value());
        } else {
            request.header(HttpHeaders.COOKIE, SESSION_COOKIE + "=" + credential.value());
        }
        return request.retrieve()
                .onStatus(status -> status.value() == 401,
                        response -> Mono.error(new OrderException("UNAUTHENTICATED",
                                "La sesión no es válida o ha expirado.", 401)))
                .onStatus(status -> status.value() == 403,
                        response -> Mono.error(new OrderException("AUTH_SERVICE_UNAVAILABLE",
                                "La solicitud de validación no está autorizada entre servicios.", 503)))
                .onStatus(status -> status.isError(),
                        response -> Mono.error(new OrderException("AUTH_SERVICE_UNAVAILABLE",
                                "No fue posible validar la sesión.", 503)))
                .bodyToMono(SessionPrincipalResponse.class)
                .switchIfEmpty(Mono.error(new OrderException("UNAUTHENTICATED",
                        "La sesión no es válida o ha expirado.", 401)))
                .map(this::authenticatedUser)
                .onErrorMap(WebClientRequestException.class, error ->
                        new OrderException("AUTH_SERVICE_UNAVAILABLE",
                                "El servicio de autenticación no está disponible.", 503))
                .onErrorMap(error -> !(error instanceof OrderException),
                        error -> new OrderException("AUTH_SERVICE_UNAVAILABLE",
                                "No fue posible validar la sesión.", 503));
    }

    private AuthenticatedUser authenticatedUser(SessionPrincipalResponse response) {
        if (response.userId() == null || response.role() == null || response.role().isBlank()) {
            throw new OrderException("AUTH_SERVICE_UNAVAILABLE",
                    "El servicio de autenticación devolvió una identidad incompleta.", 503);
        }
        return new AuthenticatedUser(response.userId(), response.role());
    }

    private void validateBaseUrl(String baseUrl, boolean allowInsecureHttp) {
        URI uri = URI.create(baseUrl);
        String host = uri.getHost();
        boolean loopbackDevelopmentHost = "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host) || "::1".equals(host);
        if (!"https".equalsIgnoreCase(uri.getScheme())
                && !loopbackDevelopmentHost
                && !allowInsecureHttp) {
            throw new IllegalArgumentException("AUTH_SESSION_BASE_URL debe usar HTTPS fuera de localhost o cuando auth.session.allow-insecure-http=true.");
        }
    }

    private record SessionPrincipalResponse(UUID userId, String role) {
    }
}
