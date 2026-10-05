package co.com.bancolombia.api;

import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.UUID;

@Component
public class OrderEventBus implements OrderEventPublisher {
    private final Sinks.Many<OrderEvent> sink = Sinks.many().replay().limit(256);

    @Override
    public void publish(OrderEvent event) {
        Sinks.EmitResult result = sink.tryEmitNext(event);
        if (result.isFailure()) {
            throw new IllegalStateException("Could not publish order event: " + result);
        }
    }

    @Override
    public Flux<OrderEvent> subscribe(UUID orderId) {
        return sink.asFlux().filter(event -> event.orderId().equals(orderId));
    }
}
