package co.com.bancolombia.model.order.gateways;

import co.com.bancolombia.model.order.CheckoutContext;
import co.com.bancolombia.model.order.CheckoutProduct;
import co.com.bancolombia.model.order.IdempotencyRecord;
import co.com.bancolombia.model.order.LocationSnapshot;
import co.com.bancolombia.model.order.NewOrder;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderPage;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.DeliveryStatus;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public interface OrderRepository {
    Mono<CheckoutContext> checkoutContext(UUID userId, UUID companyId, UUID addressId);

    Mono<CheckoutProduct> lockProduct(UUID companyId, UUID productId);

    Mono<Void> reserveInventory(UUID companyId, UUID productId, int quantity);

    Mono<IdempotencyRecord> beginIdempotency(UUID requestId, UUID userId, UUID companyId, String requestHash);

    Mono<Void> completeIdempotency(UUID requestId, UUID orderId);

    Mono<Long> createOrder(NewOrder order);

    Mono<Void> addOrderItem(UUID orderId, CheckoutProduct product, int quantity, Map<String, Object> selectedOptions);

    Mono<Void> createReservation(UUID orderId, UUID productId, int quantity, Instant expiresAt);

    Mono<Void> recordHistory(UUID orderId, OrderStateDomain domain, String previous, String next,
                             UUID actorId, OrderActorType actorType, String reason);

    Mono<Order> findById(UUID orderId, UUID requesterId);

    Mono<Order> findCompanyOrder(UUID orderId, UUID companyId, UUID actorId);

    Mono<OrderPage> list(UUID requesterId, OrderStatus status, int page, int size);

    Flux<Order> listActive(UUID requesterId);

    Mono<Void> updateStatuses(Order order, OrderStatus orderStatus, MerchantStatus merchantStatus,
                              DeliveryStatus deliveryStatus, String rejectionReason);

    Mono<Void> releaseReservations(UUID orderId, Instant releasedAt);

    Mono<Void> createShipment(UUID orderId, String pickupPin);

    Mono<LocationSnapshot> currentLocation(UUID orderId, UUID requesterId);

    Mono<Integer> expireReservations(Instant now);
}
