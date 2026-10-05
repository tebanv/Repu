package co.com.bancolombia.usecase.getorderdetails;

import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class GetOrderDetailsUseCase {
    private final OrderRepository orderRepository;

    public Mono<Order> execute(UUID orderId, UUID requesterId) {
        return orderRepository.findById(orderId, requesterId);
    }
}
