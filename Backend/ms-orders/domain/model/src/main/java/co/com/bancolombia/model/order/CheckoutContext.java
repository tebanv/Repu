package co.com.bancolombia.model.order;

import java.util.Map;
import java.util.Collections;
import java.util.LinkedHashMap;

public record CheckoutContext(Map<String, Object> addressSnapshot) {
    public CheckoutContext {
        addressSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(addressSnapshot));
    }
}
