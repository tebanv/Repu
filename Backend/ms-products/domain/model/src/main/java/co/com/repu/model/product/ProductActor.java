package co.com.repu.model.product;

import java.util.Locale;
import java.util.UUID;

public record ProductActor(UUID userId, String role) {

    public ProductActor {
        role = role == null ? null : role.toUpperCase(Locale.ROOT);
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    public boolean canManageProducts() {
        return isAdmin() || "DISTRIBUIDOR".equals(role);
    }

    public boolean isDistributor() {
        return "DISTRIBUIDOR".equals(role);
    }

    public static ProductActor publicUser() {
        return new ProductActor(null, "PUBLIC");
    }
}
