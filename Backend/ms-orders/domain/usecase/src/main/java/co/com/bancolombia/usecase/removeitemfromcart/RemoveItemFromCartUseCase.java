package co.com.bancolombia.usecase.removeitemfromcart;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class RemoveItemFromCartUseCase {
    private final CartRepository cartRepository;
    private final TransactionRunner transactionRunner;

    public Mono<Cart> execute(UUID userId, UUID itemId) {
        return transactionRunner.transactional(() -> cartRepository.removeItem(userId, itemId));
    }
}
