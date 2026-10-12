package co.com.bancolombia.usecase.cancelorder;

import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.PaymentStatus;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@RequiredArgsConstructor
public class CancelOrderUseCase {
    private final OrderRepository orderRepository;
    private final TransactionRunner transactionRunner;
    private final OrderEventPublisher eventPublisher;

    public Mono<Order> execute(UUID orderId, UUID buyerId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Mono.error(OrderException.invalid("INVALID_CANCELLATION_REASON", "La razón de cancelación es obligatoria."));
        }
        return transactionRunner.transactional(() -> orderRepository.findById(orderId, buyerId)
                .flatMap(order -> {
                    if (order.orderStatus() != OrderStatus.CREADA
                            || (order.merchantStatus() != MerchantStatus.PENDIENTE_CONFIRMACION
                            && order.merchantStatus() != MerchantStatus.ACEPTADO)) {
                        return Mono.error(OrderException.conflict("ORDER_NOT_CANCELLABLE", "La orden ya avanzó a una fase no cancelable."));
                    }
                    return orderRepository.updateStatuses(order, OrderStatus.CANCELADA,
                                    order.merchantStatus(), order.deliveryStatus(), null)
                            .then(orderRepository.recordHistory(orderId, OrderStateDomain.ORDEN, order.orderStatus().name(),
                                    OrderStatus.CANCELADA.name(), buyerId, OrderActorType.CLIENTE, reason))
                            .then(orderRepository.releaseReservations(orderId, Instant.now()))
                            .then(orderRepository.findById(orderId, buyerId));
                }))
                .doOnSuccess(order -> {
                    eventPublisher.publish(new OrderEvent(orderId, "ORDER_STATUS_UPDATED",
                            Instant.now(), OrderStatus.CANCELADA.name()));
                    if (order.paymentStatus() == PaymentStatus.PAGADO) {
                        eventPublisher.publish(new OrderEvent(orderId, "REFUND_REQUESTED", Instant.now(), reason));
                    }
                });
    }
}
