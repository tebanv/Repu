package co.com.bancolombia.usecase.getactiveorders;

import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;

import java.util.UUID;

@RequiredArgsConstructor
public class GetActiveOrdersUseCase {
    private final OrderRepository orderRepository;

    public Flux<Order> execute(UUID buyerId) {
        return orderRepository.listActive(buyerId);
    }
}
