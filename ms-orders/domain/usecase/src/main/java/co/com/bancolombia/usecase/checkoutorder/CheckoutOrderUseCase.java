package co.com.bancolombia.usecase.checkoutorder;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.itemcart.ItemCart;
import co.com.bancolombia.model.order.CheckoutContext;
import co.com.bancolombia.model.order.CheckoutProduct;
import co.com.bancolombia.model.order.DeliveryStatus;
import co.com.bancolombia.model.order.IdempotencyRecord;
import co.com.bancolombia.model.order.IdempotencyStatus;
import co.com.bancolombia.model.order.MerchantStatus;
import co.com.bancolombia.model.order.NewOrder;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderEvent;
import co.com.bancolombia.model.order.OrderActorType;
import co.com.bancolombia.model.order.OrderStateDomain;
import co.com.bancolombia.model.order.OrderStatus;
import co.com.bancolombia.model.order.PaymentStatus;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@RequiredArgsConstructor
public class CheckoutOrderUseCase {
    private final CartRepository cartRepository;
    private final OrderRepository orderRepository;
    private final TransactionRunner transactionRunner;
    private final Duration reservationTtl;
    private final OrderEventPublisher eventPublisher;

    public Mono<Order> execute(UUID userId, UUID requestId, UUID companyId, UUID addressId, String customerNotes) {
        String hash = requestHash(userId, companyId, addressId, customerNotes);
        return transactionRunner.transactional(() -> orderRepository
                .beginIdempotency(requestId, userId, companyId, hash)
                .flatMap(record -> process(record, userId, requestId, companyId, addressId, customerNotes, hash)))
                .doOnNext(result -> {
                    if (result.created()) {
                        eventPublisher.publish(new OrderEvent(result.order().id(), "ORDER_STATUS_UPDATED",
                                Instant.now(), result.order().orderStatus().name()));
                    }
                })
                .map(CheckoutResult::order);
    }

    private Mono<CheckoutResult> process(IdempotencyRecord record, UUID userId, UUID requestId, UUID companyId,
                                        UUID addressId, String customerNotes, String hash) {
        if (!record.userId().equals(userId) || !record.companyId().equals(companyId) || !record.requestHash().equals(hash)) {
            return Mono.error(OrderException.conflict("IDEMPOTENCY_CONFLICT",
                    "X-Request-ID ya fue utilizado con una solicitud diferente."));
        }
        if (record.status() == IdempotencyStatus.COMPLETADA) {
            return orderRepository.findById(record.orderId(), userId)
                    .map(order -> new CheckoutResult(order, false));
        }
        if (record.status() != IdempotencyStatus.PROCESANDO) {
            return Mono.error(OrderException.conflict("IDEMPOTENCY_CONFLICT",
                    "La solicitud idempotente ya terminó sin crear una orden."));
        }

        return cartRepository.lockActive(userId, companyId)
                .flatMap(cart -> checkout(userId, requestId, companyId, addressId, customerNotes, cart))
                .map(order -> new CheckoutResult(order, true));
    }

    private Mono<Order> checkout(UUID userId, UUID requestId, UUID companyId, UUID addressId, String customerNotes,
                                 Cart cart) {
        if (cart.items().isEmpty()) {
            return Mono.error(OrderException.invalid("CART_EMPTY", "No se puede crear una orden desde un carrito vacío."));
        }
        return orderRepository.checkoutContext(userId, companyId, addressId)
                .flatMap(context -> lockProducts(companyId, cart.items())
                        .flatMap(products -> persistCheckout(userId, requestId, companyId, customerNotes,
                                cart, context, products)));
    }

    private Mono<Map<UUID, CheckoutProduct>> lockProducts(UUID companyId, java.util.List<ItemCart> items) {
        return Flux.fromIterable(items)
                .concatMap(item -> orderRepository.lockProduct(companyId, item.productId())
                        .map(product -> Map.entry(item.productId(), product)))
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .flatMap(products -> products.size() == items.size()
                        ? Mono.just(products)
                        : Mono.error(OrderException.notFound("PRODUCT_NOT_AVAILABLE",
                                "Uno o más productos ya no están disponibles para esta empresa.")));
    }

    private Mono<Order> persistCheckout(UUID userId, UUID requestId, UUID companyId, String customerNotes, Cart cart,
                                        CheckoutContext context, Map<UUID, CheckoutProduct> products) {
        BigDecimal subtotal = cart.items().stream()
                .map(item -> products.get(item.productId()).unitPrice().multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal shippingCost = BigDecimal.ZERO;
        BigDecimal serviceFee = BigDecimal.ZERO;
        BigDecimal taxes = BigDecimal.ZERO;
        BigDecimal discounts = BigDecimal.ZERO;
        BigDecimal finalTotal = subtotal.add(shippingCost).add(serviceFee).add(taxes).subtract(discounts);
        Instant expiry = Instant.now().plus(reservationTtl);
        UUID orderId = UUID.randomUUID();
        NewOrder newOrder = new NewOrder(orderId, userId, companyId, subtotal, shippingCost, serviceFee, taxes,
                discounts, finalTotal, context.addressSnapshot(), customerNotes);

        return orderRepository.createOrder(newOrder)
                .thenMany(Flux.fromIterable(cart.items())
                        .concatMap(item -> persistItemAndReserve(orderId, companyId, item, products.get(item.productId()), expiry)))
                .then(orderRepository.recordHistory(orderId, OrderStateDomain.ORDEN, null,
                        OrderStatus.CREADA.name(), userId, OrderActorType.CLIENTE, null))
                .then(orderRepository.recordHistory(orderId, OrderStateDomain.PAGO, null,
                        PaymentStatus.PENDIENTE.name(), userId, OrderActorType.CLIENTE, null))
                .then(orderRepository.recordHistory(orderId, OrderStateDomain.COMERCIO, null,
                        MerchantStatus.PENDIENTE_CONFIRMACION.name(), userId, OrderActorType.CLIENTE, null))
                .then(orderRepository.recordHistory(orderId, OrderStateDomain.ENVIO, null,
                        DeliveryStatus.NO_ASIGNADO.name(), userId, OrderActorType.CLIENTE, null))
                .then(cartRepository.convert(cart.id()))
                .then(orderRepository.completeIdempotency(requestId, orderId))
                .then(orderRepository.findById(orderId, userId));
    }

    private Mono<Void> persistItemAndReserve(UUID orderId, UUID companyId, ItemCart item,
                                             CheckoutProduct product, Instant expiry) {
        return orderRepository.reserveInventory(companyId, product.productId(), item.quantity())
                .then(orderRepository.addOrderItem(orderId, product, item.quantity(), item.selectedOptions()))
                .then(orderRepository.createReservation(orderId, product.productId(), item.quantity(), expiry));
    }

    private String requestHash(UUID userId, UUID companyId, UUID addressId, String customerNotes) {
        String canonical = userId + "\n" + companyId + "\n" + addressId + "\n" + (customerNotes == null ? "" : customerNotes);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime.", exception);
        }
    }

    private record CheckoutResult(Order order, boolean created) {
    }
}
