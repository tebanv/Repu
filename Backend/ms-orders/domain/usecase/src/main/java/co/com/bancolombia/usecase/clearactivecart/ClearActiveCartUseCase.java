package co.com.bancolombia.usecase.clearactivecart;

import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class ClearActiveCartUseCase {
    private final CartRepository cartRepository;
    private final TransactionRunner transactionRunner;

    public Mono<Void> execute(UUID userId) {
        return transactionRunner.transactional(() -> cartRepository.clearActive(userId));
    }
}
