package co.com.repu.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.UUID;

@Service
public class SessionAuthenticationService {

    static final String SESSION_COOKIE_NAME = "__Host-repu_session";

    private final WebClient webClient;

    public SessionAuthenticationService(@Value("${auth.session.base-url}") String baseUrl,
                                        @Value("${auth.session.service-token:}") String serviceToken) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl);

        if (serviceToken != null && !serviceToken.isBlank()) {
            builder.defaultHeader("X-Auth-Service-Token", serviceToken);
        }

        this.webClient = builder.build();
    }

    public Mono<SessionPrincipal> authenticate(String token, boolean bearer) {
        if (token == null || token.isBlank()) {
            return Mono.empty();
        }

        WebClient.RequestHeadersSpec<?> request = webClient.get()
                .uri(URI.create("/api/auth/session"));

        if (bearer) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        } else {
            request.header(HttpHeaders.COOKIE, SESSION_COOKIE_NAME + "=" + token);
        }

        return request.retrieve()
                .onStatus(HttpStatusCode::isError, response -> Mono.empty())
                .bodyToMono(AuthSessionResponse.class)
                .map(response -> new SessionPrincipal(response.userId(), response.role()))
                .onErrorResume(error -> Mono.empty());
    }

    public record SessionPrincipal(UUID userId, String role) {
    }

    public record AuthSessionResponse(UUID userId, String role) {
    }
}
