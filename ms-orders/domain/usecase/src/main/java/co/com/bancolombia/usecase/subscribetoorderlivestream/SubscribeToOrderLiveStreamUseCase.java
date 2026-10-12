package co.com.bancolombia.usecase.subscribetoorderlivestream;

import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;

import java.util.UUID;

@RequiredArgsConstructor
public class SubscribeToOrderLiveStreamUseCase {
    private final OrderRepository orderRepository;
    private final OrderEventPublisher eventPublisher;

    public Flux<OrderEvent> execute(UUID orderId, UUID requesterId) {
        return orderRepository.findById(orderId, requesterId)
                .flatMapMany(order -> eventPublisher.subscribe(orderId));
    }
}
