package co.com.bancolombia.usecase.markorderready;

import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

@RequiredArgsConstructor
public class MarkOrderReadyUseCase {
    private final OrderRepository orders;
    private final TransactionRunner transactions;
    private final OrderEventPublisher events;
    private final SecureRandom secureRandom;

    public Mono<Order> execute(UUID companyId, UUID orderId, UUID actorId) {
        return transactions.transactional(() -> orders.findCompanyOrder(orderId, companyId, actorId)
                .flatMap(order -> {
                    if (order.merchantStatus() != MerchantStatus.EN_PREPARACION
                            || order.orderStatus() != OrderStatus.CONFIRMADA) {
                        return Mono.error(OrderException.conflict("INVALID_STATE_TRANSITION",
                                "Solo una orden en preparación puede marcarse lista."));
                    }
                    String pin = "%06d".formatted(secureRandom.nextInt(1_000_000));
                    return orders.updateStatuses(order, OrderStatus.EN_PROCESO, MerchantStatus.LISTO_PARA_RECOGIDA,
                                    order.deliveryStatus(), null)
                            .then(orders.createShipment(orderId, pin))
                            .then(orders.recordHistory(orderId, OrderStateDomain.COMERCIO, order.merchantStatus().name(),
                                    MerchantStatus.LISTO_PARA_RECOGIDA.name(), actorId, OrderActorType.COMERCIO, null))
                            .then(orders.recordHistory(orderId, OrderStateDomain.ORDEN, order.orderStatus().name(),
                                    OrderStatus.EN_PROCESO.name(), actorId, OrderActorType.COMERCIO, null))
                            .then(orders.findCompanyOrder(orderId, companyId, actorId));
                }))
                .doOnSuccess(order -> events.publish(new OrderEvent(orderId, "ORDER_STATUS_UPDATED",
                        Instant.now(), order.orderStatus().name())));
    }
}
