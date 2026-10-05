package co.com.bancolombia.model.order;

import java.time.Instant;
import java.util.UUID;

public record LocationSnapshot(UUID driverId, double latitude, double longitude, Double speedKmH,
                               Double heading, Integer estimatedMinutesToArrival, Instant recordedAt) {
}
