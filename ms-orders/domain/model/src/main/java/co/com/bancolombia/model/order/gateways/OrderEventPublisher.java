package co.com.bancolombia.model.order.gateways;

import co.com.bancolombia.model.order.OrderEvent;
import reactor.core.publisher.Flux;

import java.util.UUID;

public interface OrderEventPublisher {
    void publish(OrderEvent event);

    Flux<OrderEvent> subscribe(UUID orderId);
}
