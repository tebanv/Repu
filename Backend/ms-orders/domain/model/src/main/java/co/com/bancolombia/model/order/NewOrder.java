package co.com.bancolombia.model.order;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public record NewOrder(
        UUID id, UUID buyerUserId, UUID companyId, BigDecimal subtotal, BigDecimal shippingCost,
        BigDecimal serviceFee, BigDecimal taxes, BigDecimal discounts, BigDecimal finalTotal,
        Map<String, Object> addressSnapshot, String customerNotes) {
    public NewOrder {
        if (subtotal == null || shippingCost == null || serviceFee == null || taxes == null
                || discounts == null || finalTotal == null
                || subtotal.signum() < 0 || shippingCost.signum() < 0 || serviceFee.signum() < 0
                || taxes.signum() < 0 || discounts.signum() < 0 || finalTotal.signum() < 0
                || finalTotal.compareTo(subtotal.add(shippingCost).add(serviceFee).add(taxes).subtract(discounts)) != 0) {
            throw new IllegalArgumentException("Order totals must be non-negative and internally consistent.");
        }
        addressSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(addressSnapshot));
    }
}
