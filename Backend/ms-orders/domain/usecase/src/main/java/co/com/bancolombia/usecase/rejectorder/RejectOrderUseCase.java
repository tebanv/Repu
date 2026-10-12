package co.com.bancolombia.usecase.rejectorder;

import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.PaymentStatus;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@RequiredArgsConstructor
public class RejectOrderUseCase {
    private final OrderRepository orders;
    private final TransactionRunner transactions;
    private final OrderEventPublisher events;

    public Mono<Order> execute(UUID companyId, UUID orderId, UUID actorId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Mono.error(OrderException.invalid("INVALID_REJECTION_REASON", "La razón de rechazo es obligatoria."));
        }
        return transactions.transactional(() -> orders.findCompanyOrder(orderId, companyId, actorId)
                .flatMap(order -> {
                    if (order.orderStatus() == OrderStatus.COMPLETADA || order.orderStatus() == OrderStatus.CANCELADA
                            || order.merchantStatus() == MerchantStatus.RECHAZADO
                            || order.merchantStatus() == MerchantStatus.LISTO_PARA_RECOGIDA) {
                        return Mono.error(OrderException.conflict("INVALID_STATE_TRANSITION",
                                "La orden ya no puede ser rechazada en su estado actual."));
                    }
                    return orders.updateStatuses(order, OrderStatus.CANCELADA, MerchantStatus.RECHAZADO,
                                    order.deliveryStatus(), reason)
                            .then(orders.recordHistory(orderId, OrderStateDomain.COMERCIO, order.merchantStatus().name(),
                                    MerchantStatus.RECHAZADO.name(), actorId, OrderActorType.COMERCIO, reason))
                            .then(orders.recordHistory(orderId, OrderStateDomain.ORDEN, order.orderStatus().name(),
                                    OrderStatus.CANCELADA.name(), actorId, OrderActorType.COMERCIO, reason))
                            .then(orders.releaseReservations(orderId, Instant.now()))
                            .then(orders.findCompanyOrder(orderId, companyId, actorId));
                }))
                .doOnSuccess(order -> {
                    events.publish(new OrderEvent(orderId, "ORDER_STATUS_UPDATED", Instant.now(), OrderStatus.CANCELADA.name()));
                    if (order.paymentStatus() == PaymentStatus.PAGADO) {
                        events.publish(new OrderEvent(orderId, "REFUND_REQUESTED", Instant.now(), "Rechazo del comercio"));
                    }
                });
    }
}
