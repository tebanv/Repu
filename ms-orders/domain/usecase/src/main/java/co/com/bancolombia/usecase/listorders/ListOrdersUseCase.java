package co.com.bancolombia.usecase.listorders;

import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderPage;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class ListOrdersUseCase {
    private final OrderRepository orderRepository;

    public Mono<OrderPage> execute(UUID requesterId, String status, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            return Mono.error(OrderException.invalid("INVALID_PAGINATION", "La paginación debe usar page >= 0 y size entre 1 y 100."));
        }
        OrderStatus parsedStatus;
        try {
            parsedStatus = status == null ? null : OrderStatus.valueOf(status);
        } catch (IllegalArgumentException exception) {
            return Mono.error(OrderException.invalid("INVALID_ORDER_STATUS", "El estado de orden no es válido."));
        }
        return orderRepository.list(requesterId, parsedStatus, page, size);
    }
}
