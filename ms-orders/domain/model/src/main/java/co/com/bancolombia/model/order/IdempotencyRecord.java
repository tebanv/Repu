package co.com.bancolombia.model.order;

import java.util.UUID;

public record IdempotencyRecord(
        UUID userId, UUID companyId, String requestHash, IdempotencyStatus status, UUID orderId) {
}
