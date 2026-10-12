package co.com.bancolombia.model.order;

import java.time.Duration;

public interface ReservationPolicy {
    Duration reservationTtl();
}
