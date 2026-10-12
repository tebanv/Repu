package co.com.bancolombia.model.auth;

import java.util.UUID;

public record AuthenticatedUser(UUID userId, String role) {
}
