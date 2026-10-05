package co.com.bancolombia.model.itemorder;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public record ItemOrder(
        UUID id,
        UUID productId,
        String nameSnapshot,
        String skuSnapshot,
        int quantity,
        BigDecimal unitPriceSnapshot,
        BigDecimal lineTotal,
        Map<String, Object> characteristicsSnapshot,
        Map<String, Object> selectedOptionsSnapshot) {
    public ItemOrder {
        if (quantity < 1 || unitPriceSnapshot.signum() < 0 || lineTotal.signum() < 0) {
            throw new IllegalArgumentException("Order item quantities and monetary values must be valid.");
        }
        characteristicsSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(characteristicsSnapshot));
        selectedOptionsSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(selectedOptionsSnapshot));
    }
}
