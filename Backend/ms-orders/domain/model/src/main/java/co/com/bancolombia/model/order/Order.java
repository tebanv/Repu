package co.com.bancolombia.model.order;

import co.com.bancolombia.model.itemorder.ItemOrder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record Order(
        UUID id,
        long humanReadableId,
        UUID buyerUserId,
        UUID companyId,
        int version,
        OrderStatus orderStatus,
        PaymentStatus paymentStatus,
        MerchantStatus merchantStatus,
        DeliveryStatus deliveryStatus,
        BigDecimal subtotal,
        BigDecimal shippingCost,
        BigDecimal discounts,
        BigDecimal taxes,
        BigDecimal serviceFee,
        BigDecimal finalTotal,
        Map<String, Object> deliveryAddressSnapshot,
        String customerNotes,
        Instant createdAt,
        List<ItemOrder> items) {
    public Order {
        deliveryAddressSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(deliveryAddressSnapshot));
        items = List.copyOf(items);
    }
}
