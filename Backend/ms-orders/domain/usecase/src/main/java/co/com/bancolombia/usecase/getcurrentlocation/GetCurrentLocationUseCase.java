package co.com.bancolombia.usecase.getcurrentlocation;

import co.com.bancolombia.model.order.LocationSnapshot;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class GetCurrentLocationUseCase {
    private final OrderRepository orders;

    public Mono<LocationSnapshot> execute(UUID orderId, UUID requesterId) {
        return orders.currentLocation(orderId, requesterId);
    }
}
