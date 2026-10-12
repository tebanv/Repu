package co.com.bancolombia.api;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.itemcart.ItemCart;
import co.com.bancolombia.model.itemorder.ItemOrder;
import co.com.bancolombia.model.order.LocationSnapshot;
import co.com.bancolombia.model.order.Order;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.OrderPage;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class OrderRestMapper {
    private OrderRestMapper() {
    }

    public static CartResponse cart(Cart cart) {
        return new CartResponse(cart.id(), cart.companyId(), cart.items().stream().map(OrderRestMapper::cartItem).toList(),
                cart.total());
    }

    public static CartItemResponse cartItem(ItemCart item) {
        return new CartItemResponse(item.id(), item.productId(), item.productName(), item.unitPrice(),
                item.quantity(), item.subtotal());
    }

    public static OrderResponse order(Order order) {
        return new OrderResponse(order.id(), order.humanReadableId(), order.buyerUserId(), order.companyId(),
                order.version(), order.orderStatus().name(), order.paymentStatus().name(),
                order.merchantStatus().name(), order.deliveryStatus().name(), order.subtotal(),
                order.shippingCost(), order.discounts(), order.taxes(), order.finalTotal(), order.serviceFee(),
                order.deliveryAddressSnapshot(), order.items().stream().map(OrderRestMapper::orderItem).toList(),
                order.createdAt());
    }

    public static OrderItemResponse orderItem(ItemOrder item) {
        return new OrderItemResponse(item.id(), item.productId(), item.nameSnapshot(), item.skuSnapshot(),
                item.unitPriceSnapshot(), item.quantity(), item.lineTotal(), item.selectedOptionsSnapshot());
    }

    public static PagedOrderResponse page(OrderPage page) {
        return new PagedOrderResponse(page.content().stream().map(OrderRestMapper::order).toList(),
                new PageMetadata(page.totalElements(), page.totalPages(), page.number(), page.size()));
    }

    public static LocationResponse location(LocationSnapshot location) {
        return new LocationResponse(location.driverId(), location.latitude(), location.longitude(),
                location.speedKmH(), location.heading(), location.estimatedMinutesToArrival(), location.recordedAt());
    }

    public record CartItemInput(UUID companyId, UUID productId, int quantity, Map<String, Object> selectedOptions) {
        public CartItemInput {
            if (companyId == null || productId == null || quantity < 1) {
                throw OrderException.invalid("INVALID_REQUEST", "companyId, productId y quantity mayor que cero son obligatorios.");
            }
        }
    }

    public record CheckoutRequest(UUID companyId, UUID addressId, String customerNotes) {
        public CheckoutRequest {
            if (companyId == null || addressId == null) {
                throw OrderException.invalid("INVALID_REQUEST", "companyId y addressId son obligatorios.");
            }
        }
    }

    public record ReasonRequest(String reason) {
        public ReasonRequest {
            if (reason == null || reason.isBlank()) {
                throw OrderException.invalid("INVALID_REQUEST", "reason es obligatorio.");
            }
        }
    }

    public record CartResponse(UUID id, UUID companyId, List<CartItemResponse> items, BigDecimal total) {
    }

    public record CartItemResponse(UUID id, UUID productId, String productName, BigDecimal unitPrice,
                                   int quantity, BigDecimal subtotal) {
    }

    public record OrderItemResponse(UUID itemId, UUID productId, String nameSnapshot, String skuSnapshot,
                                    BigDecimal unitPriceSnapshot, int quantity, BigDecimal lineTotal,
                                    Map<String, Object> selectedOptionsSnapshot) {
    }

    public record OrderResponse(
            UUID id,
            long humanReadableId,
            UUID buyerUserId,
            UUID companyId,
            int version,
            String orderStatus,
            String paymentStatus,
            String merchantStatus,
            String deliveryStatus,
            BigDecimal subtotal,
            BigDecimal shippingCost,
            BigDecimal discounts,
            BigDecimal taxes,
            BigDecimal finalTotal,
            BigDecimal serviceFee,
            Map<String, Object> deliveryAddressSnapshot,
            List<OrderItemResponse> items,
            Instant createdAt) {
    }

    public record PageMetadata(long totalElements, int totalPages, int number, int size) {
    }

    public record PagedOrderResponse(List<OrderResponse> content, PageMetadata page) {
    }

    public record LocationResponse(UUID driverId, double latitude, double longitude, Double speedKmH,
                                   Double heading, Integer estimatedMinutesToArrival, Instant recordedAt) {
    }
}
