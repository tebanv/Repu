package co.com.bancolombia.config;

import co.com.bancolombia.model.order.ReservationPolicy;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "orders")
public record OrdersProperties(Duration reservationTtl) implements ReservationPolicy {
    public OrdersProperties {
        if (reservationTtl == null || reservationTtl.isNegative() || reservationTtl.isZero()) {
            throw new IllegalArgumentException("orders.reservation-ttl must be a positive duration.");
        }
    }
}
