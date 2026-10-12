package co.com.bancolombia.model.order;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public record CheckoutProduct(UUID productId, String name, String sku, BigDecimal unitPrice,
                              Map<String, Object> characteristics) {
    public CheckoutProduct {
        if (unitPrice.signum() < 0) {
            throw new IllegalArgumentException("Product price cannot be negative.");
        }
        characteristics = Collections.unmodifiableMap(new LinkedHashMap<>(characteristics));
    }
}
