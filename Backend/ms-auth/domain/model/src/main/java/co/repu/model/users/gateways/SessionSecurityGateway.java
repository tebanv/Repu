package co.repu.model.users.gateways;

import co.repu.model.users.Session;
import reactor.core.publisher.Mono;

public interface SessionSecurityGateway {
    Mono<Session> authenticate(String rawToken);
    Mono<Void> cache(Session session);
    Mono<Void> evict(Session session);
}
