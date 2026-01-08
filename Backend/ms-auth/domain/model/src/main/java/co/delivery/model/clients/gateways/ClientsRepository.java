package co.delivery.model.clients.gateways;

import co.delivery.model.clients.Client;
import reactor.core.publisher.Mono;

public interface ClientsRepository {
    Mono<Client> findByEmail(String companyId, String email);
}
