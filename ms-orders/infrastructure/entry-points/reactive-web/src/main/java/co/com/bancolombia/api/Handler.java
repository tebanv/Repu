package co.com.bancolombia.api;

import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.usecase.acceptorder.AcceptOrderUseCase;
import co.com.bancolombia.usecase.additemtocart.AddItemToCartUseCase;
import co.com.bancolombia.usecase.cancelorder.CancelOrderUseCase;
import co.com.bancolombia.usecase.checkoutorder.CheckoutOrderUseCase;
import co.com.bancolombia.usecase.getactivecart.GetActiveCartUseCase;
import co.com.bancolombia.usecase.getactiveorders.GetActiveOrdersUseCase;
import co.com.bancolombia.usecase.getcurrentlocation.GetCurrentLocationUseCase;
import co.com.bancolombia.usecase.getorderdetails.GetOrderDetailsUseCase;
import co.com.bancolombia.usecase.listorders.ListOrdersUseCase;
import co.com.bancolombia.usecase.markorderready.MarkOrderReadyUseCase;
import co.com.bancolombia.usecase.rejectorder.RejectOrderUseCase;
import co.com.bancolombia.usecase.removeitemfromcart.RemoveItemFromCartUseCase;
import co.com.bancolombia.usecase.subscribetoorderlivestream.SubscribeToOrderLiveStreamUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.util.UUID;
import java.net.URI;

@Component
@RequiredArgsConstructor
public class Handler {
    private final GetActiveCartUseCase getCart;
    private final AddItemToCartUseCase addCartItem;
    private final RemoveItemFromCartUseCase removeCartItem;
    private final CheckoutOrderUseCase checkoutOrder;
    private final ListOrdersUseCase listOrders;
    private final GetActiveOrdersUseCase activeOrders;
    private final GetOrderDetailsUseCase getOrder;
    private final CancelOrderUseCase cancelOrder;
    private final AcceptOrderUseCase acceptOrder;
    private final RejectOrderUseCase rejectOrder;
    private final MarkOrderReadyUseCase markReady;
    private final SubscribeToOrderLiveStreamUseCase liveStream;
    private final GetCurrentLocationUseCase currentLocation;

    public Mono<ServerResponse> getCart(ServerRequest request) {
        return authenticatedUser(request).flatMap(userId -> getCart.execute(userId,
                        uuid(request.queryParam("companyId").orElseThrow(() ->
                                OrderException.invalid("INVALID_REQUEST", "companyId es obligatorio."))))
                .map(OrderRestMapper::cart)
                .flatMap(body -> ServerResponse.ok().bodyValue(body)));
    }

    public Mono<ServerResponse> addCartItem(ServerRequest request) {
        return authenticatedUser(request)
                .zipWith(request.bodyToMono(OrderRestMapper.CartItemInput.class)
                        .switchIfEmpty(Mono.error(OrderException.invalid("INVALID_REQUEST", "El cuerpo de la solicitud es obligatorio."))))
                .flatMap(tuple -> {
                    var input = tuple.getT2();
                    return addCartItem.execute(tuple.getT1(), input.companyId(), input.productId(), input.quantity(),
                                    input.selectedOptions())
                            .map(OrderRestMapper::cart)
                            .flatMap(body -> ServerResponse.ok().bodyValue(body));
                });
    }

    public Mono<ServerResponse> removeCartItem(ServerRequest request) {
        return authenticatedUser(request)
                .flatMap(userId -> removeCartItem.execute(userId, uuid(request.pathVariable("itemId"))))
                .map(OrderRestMapper::cart)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> checkout(ServerRequest request) {
        UUID requestId = request.headers().firstHeader("X-Request-ID") == null
                ? null : uuid(request.headers().firstHeader("X-Request-ID"));
        if (requestId == null) {
            return Mono.error(OrderException.invalid("INVALID_REQUEST", "La cabecera X-Request-ID es obligatoria."));
        }
        return authenticatedUser(request)
                .zipWith(request.bodyToMono(OrderRestMapper.CheckoutRequest.class)
                        .switchIfEmpty(Mono.error(OrderException.invalid("INVALID_REQUEST", "El cuerpo de la solicitud es obligatorio."))))
                .flatMap(tuple -> {
                    var body = tuple.getT2();
                    return checkoutOrder.execute(tuple.getT1(), requestId, body.companyId(), body.addressId(), body.customerNotes())
                            .map(OrderRestMapper::order)
                            .flatMap(order -> ServerResponse.created(URI.create("/orders/" + order.id())).bodyValue(order));
                });
    }

    public Mono<ServerResponse> listOrders(ServerRequest request) {
        String status = request.queryParam("status").orElse(null);
        int page = integerParam(request, "page", 0);
        int size = integerParam(request, "size", 20);
        return authenticatedUser(request)
                .flatMap(userId -> listOrders.execute(userId, status, page, size))
                .map(OrderRestMapper::page)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> activeOrders(ServerRequest request) {
        return authenticatedUser(request)
                .flatMapMany(activeOrders::execute)
                .map(OrderRestMapper::order)
                .collectList()
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> orderDetails(ServerRequest request) {
        return authenticatedUser(request)
                .flatMap(userId -> getOrder.execute(uuid(request.pathVariable("orderId")), userId))
                .map(OrderRestMapper::order)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> cancelOrder(ServerRequest request) {
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .zipWith(request.bodyToMono(OrderRestMapper.ReasonRequest.class)
                        .switchIfEmpty(Mono.error(OrderException.invalid("INVALID_REQUEST", "El cuerpo de la solicitud es obligatorio."))))
                .flatMap(tuple -> cancelOrder.execute(orderId, tuple.getT1(), tuple.getT2().reason()))
                .map(OrderRestMapper::order)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> acceptOrder(ServerRequest request) {
        UUID companyId = uuid(request.pathVariable("companyId"));
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .flatMap(actorId -> acceptOrder.execute(companyId, orderId, actorId))
                .map(OrderRestMapper::order)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> rejectOrder(ServerRequest request) {
        UUID companyId = uuid(request.pathVariable("companyId"));
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .zipWith(request.bodyToMono(OrderRestMapper.ReasonRequest.class)
                        .switchIfEmpty(Mono.error(OrderException.invalid("INVALID_REQUEST", "El cuerpo de la solicitud es obligatorio."))))
                .flatMap(tuple -> rejectOrder.execute(companyId, orderId, tuple.getT1(), tuple.getT2().reason()))
                .map(OrderRestMapper::order)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> markReady(ServerRequest request) {
        UUID companyId = uuid(request.pathVariable("companyId"));
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .flatMap(actorId -> markReady.execute(companyId, orderId, actorId))
                .map(OrderRestMapper::order)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    public Mono<ServerResponse> liveStream(ServerRequest request) {
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .flatMapMany(userId -> liveStream.execute(orderId, userId))
                .map(event -> ServerSentEvent.<String>builder(event.payload())
                        .id(event.occurredAt().toString())
                        .event(event.type())
                        .build())
                .as(events -> ServerResponse.ok().contentType(MediaType.TEXT_EVENT_STREAM)
                        .header("Cache-Control", "no-cache")
                        .body(events, ServerSentEvent.class));
    }

    public Mono<ServerResponse> trackingSnapshot(ServerRequest request) {
        UUID orderId = uuid(request.pathVariable("orderId"));
        return authenticatedUser(request)
                .flatMap(userId -> currentLocation.execute(orderId, userId))
                .map(OrderRestMapper::location)
                .flatMap(body -> ServerResponse.ok().bodyValue(body));
    }

    private Mono<UUID> authenticatedUser(ServerRequest request) {
        return request.principal()
                .switchIfEmpty(Mono.error(new OrderException("UNAUTHENTICATED", "Se requiere una sesión autenticada.", 401)))
                .map(principal -> uuid(principal.getName()));
    }

    private UUID uuid(String value) {
        try {
            if (value == null) {
                throw new IllegalArgumentException("UUID is missing.");
            }
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw OrderException.invalid("INVALID_REQUEST", "Se esperaba un UUID válido.");
        }
    }

    private int integerParam(ServerRequest request, String name, int defaultValue) {
        try {
            return request.queryParam(name).map(Integer::parseInt).orElse(defaultValue);
        } catch (NumberFormatException exception) {
            throw OrderException.invalid("INVALID_PAGINATION", name + " debe ser un número entero.");
        }
    }
}
