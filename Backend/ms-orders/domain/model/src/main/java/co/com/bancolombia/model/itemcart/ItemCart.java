package co.com.bancolombia.model.itemcart;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public record ItemCart(
        UUID id,
        UUID productId,
        String productName,
        String sku,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal subtotal,
        Map<String, Object> selectedOptions) {
    public ItemCart {
        if (quantity < 1) {
            throw new IllegalArgumentException("Cart item quantity must be positive.");
        }
        selectedOptions = Collections.unmodifiableMap(new LinkedHashMap<>(selectedOptions));
    }
}
