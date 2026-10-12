package co.repu.api.dto;

import java.util.UUID;

public record CurrentSessionResponse(UUID userId, String role) {
}
