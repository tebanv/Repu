package co.com.bancolombia.usecase.getactivecart;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.OrderException;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class GetActiveCartUseCase {
    private final CartRepository cartRepository;

    public Mono<Cart> execute(UUID userId, UUID companyId) {
        return cartRepository.findActive(userId, companyId)
                .switchIfEmpty(Mono.error(OrderException.notFound("CART_NOT_FOUND", "No existe un carrito activo para esta empresa.")));
    }
}
