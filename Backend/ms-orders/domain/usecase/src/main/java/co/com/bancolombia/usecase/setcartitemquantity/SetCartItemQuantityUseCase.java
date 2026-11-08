package co.com.bancolombia.usecase.setcartitemquantity;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class SetCartItemQuantityUseCase {
    private final CartRepository cartRepository;
    private final TransactionRunner transactionRunner;

    public Mono<Cart> execute(UUID userId, UUID companyId, UUID productId, int quantity) {
        if (quantity < 0) {
            return Mono.error(OrderException.invalid("INVALID_REQUEST", "quantity no puede ser negativo."));
        }
        return transactionRunner.transactional(
                () -> cartRepository.setItemQuantity(userId, companyId, productId, quantity));
    }
}
