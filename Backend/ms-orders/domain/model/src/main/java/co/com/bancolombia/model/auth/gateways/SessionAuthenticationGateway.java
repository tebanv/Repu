package co.com.bancolombia.model.auth.gateways;

import co.com.bancolombia.model.auth.AuthenticatedUser;
import co.com.bancolombia.model.auth.SessionCredential;
import reactor.core.publisher.Mono;

public interface SessionAuthenticationGateway {
    Mono<AuthenticatedUser> authenticate(SessionCredential credential, String requestId);
}
