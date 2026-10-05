package co.com.bancolombia.usecase.additemtocart;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

@RequiredArgsConstructor
public class AddItemToCartUseCase {
    private final CartRepository cartRepository;
    private final TransactionRunner transactionRunner;

    public Mono<Cart> execute(UUID userId, UUID companyId, UUID productId, int quantity,
                              Map<String, Object> selectedOptions) {
        if (quantity < 1) {
            return Mono.error(OrderException.invalid("INVALID_QUANTITY", "La cantidad debe ser mayor que cero."));
        }
        return transactionRunner.transactional(() -> cartRepository.addItem(userId, companyId, productId, quantity,
                selectedOptions == null ? Map.of() : selectedOptions));
    }
}
