package co.delivery.r2dbc;

import co.delivery.r2dbc.data.ClientData;
import org.springframework.data.repository.query.ReactiveQueryByExampleExecutor;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface ClientReactiveRepository extends ReactiveCrudRepository<ClientData, Integer>, ReactiveQueryByExampleExecutor<ClientData> {

    Mono<ClientData> findByCompanyIdAndEmail(String companyId, String email);
}
