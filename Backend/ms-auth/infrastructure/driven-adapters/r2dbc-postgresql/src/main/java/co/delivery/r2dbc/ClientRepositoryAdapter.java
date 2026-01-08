package co.delivery.r2dbc;

import co.delivery.model.clients.Client;
import co.delivery.model.clients.gateways.ClientsRepository;
import co.delivery.r2dbc.data.ClientData;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
@RequiredArgsConstructor
@Log4j2
public class ClientRepositoryAdapter implements ClientsRepository {

    private final ClientReactiveRepository clientReactiveRepository;

    @Override
    public Mono<Client> findByEmail(String companyId, String email) {

        return clientReactiveRepository.findByCompanyIdAndEmail(companyId, email)
                .map(this::toEntity);
    }

    private Client toEntity(ClientData data) {
        if (data == null) return null;

        log.info("Cliente encontrado: {}", data);
        return Client.builder()
                .id(data.getId())
                .name(data.getName())
                .email(data.getEmail())
                .password(data.getPassword())
                .status(data.getStatus())
                .companyId(data.getCompanyId())
                .role("client")
                .build();
    }

}
