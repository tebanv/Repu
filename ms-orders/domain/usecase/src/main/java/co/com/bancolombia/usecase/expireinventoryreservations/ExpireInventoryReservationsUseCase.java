package co.com.bancolombia.usecase.expireinventoryreservations;

import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.Instant;

@RequiredArgsConstructor
public class ExpireInventoryReservationsUseCase {
    private final OrderRepository orders;
    private final TransactionRunner transactions;

    public Mono<Integer> execute(Instant now) {
        return transactions.transactional(() -> orders.expireReservations(now));
    }
}
