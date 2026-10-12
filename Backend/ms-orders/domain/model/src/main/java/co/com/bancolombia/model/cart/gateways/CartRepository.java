package co.com.bancolombia.model.cart.gateways;

import co.com.bancolombia.model.cart.Cart;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

public interface CartRepository {
    Mono<Cart> findActive(UUID userId, UUID companyId);

    Mono<Cart> addItem(UUID userId, UUID companyId, UUID productId, int quantity, Map<String, Object> selectedOptions);

    Mono<Cart> removeItem(UUID userId, UUID itemId);

    Mono<Cart> lockActive(UUID userId, UUID companyId);

    Mono<Void> convert(UUID cartId);
}
