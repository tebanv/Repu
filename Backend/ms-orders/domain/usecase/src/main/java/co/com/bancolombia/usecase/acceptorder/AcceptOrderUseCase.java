package co.com.bancolombia.usecase.acceptorder;

import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.PaymentStatus;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@RequiredArgsConstructor
public class AcceptOrderUseCase {
    private final OrderRepository orders;
    private final TransactionRunner transactions;
    private final OrderEventPublisher events;

    public Mono<Order> execute(UUID companyId, UUID orderId, UUID actorId) {
        return transactions.transactional(() -> orders.findCompanyOrder(orderId, companyId, actorId)
                .flatMap(order -> {
                    if (order.paymentStatus() != PaymentStatus.PAGADO
                            || order.merchantStatus() != MerchantStatus.PENDIENTE_CONFIRMACION
                            || order.orderStatus() != OrderStatus.CREADA) {
                        return Mono.error(OrderException.conflict("INVALID_STATE_TRANSITION",
                                "La orden solo se acepta cuando está creada, pendiente de confirmación y pagada."));
                    }
                    return orders.updateStatuses(order, OrderStatus.CONFIRMADA, MerchantStatus.EN_PREPARACION,
                                    order.deliveryStatus(), null)
                            .then(orders.recordHistory(orderId, OrderStateDomain.COMERCIO, order.merchantStatus().name(),
                                    MerchantStatus.EN_PREPARACION.name(), actorId, OrderActorType.COMERCIO, null))
                            .then(orders.recordHistory(orderId, OrderStateDomain.ORDEN, order.orderStatus().name(),
                                    OrderStatus.CONFIRMADA.name(), actorId, OrderActorType.COMERCIO, null))
                            .then(orders.findCompanyOrder(orderId, companyId, actorId));
                }))
                .doOnSuccess(order -> events.publish(new OrderEvent(orderId, "ORDER_STATUS_UPDATED",
                        Instant.now(), order.orderStatus().name())));
    }
}
