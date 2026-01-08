package co.delivery.usecase.auth;

import co.delivery.model.clients.gateways.ClientsRepository;
import co.delivery.model.clients.gateways.SecurityGateway;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class AuthUseCase {

    private final ClientsRepository clientsRepository;
    private final SecurityGateway securityGateway;

    public Mono<String> login(String companyId, String email, String password) {
        return clientsRepository.findByEmail(companyId, email)
                .switchIfEmpty(Mono.error(new RuntimeException("Cliente no encontrado")))
                .flatMap(client -> {
                    if ("inactivo".equalsIgnoreCase(client.getStatus())) {
                        return Mono.error(new RuntimeException("Cliente inactivo"));
                    }
                    if (securityGateway.validatePassword(password, client.getPassword())) {
                        return Mono.just(securityGateway.generateToken(client));
                    }
                    return Mono.error(new RuntimeException("Credenciales inválidas"));
                });
    }

}
