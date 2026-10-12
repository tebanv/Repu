package co.com.bancolombia.model.order;

import java.time.Instant;
import java.util.UUID;

public record OrderEvent(UUID orderId, String type, Instant occurredAt, String payload) {
}
