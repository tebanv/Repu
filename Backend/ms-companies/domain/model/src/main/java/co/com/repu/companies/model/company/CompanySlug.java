package co.com.repu.companies.model.company;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

public final class CompanySlug {

    public static final int MAX_LENGTH = 150;

    private CompanySlug() {}

    public static String normalize(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Slug cannot be blank");
        }

        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (normalized.isBlank() || normalized.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Slug must normalize to 1-" + MAX_LENGTH + " characters");
        }
        return normalized;
    }

    public static String generate(String name, UUID id) {
        String normalized = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        String base = normalized.isBlank() ? "company" : normalized;
        String suffix = id.toString().substring(0, 8);
        int maxBaseLength = MAX_LENGTH - suffix.length() - 1;
        return base.substring(0, Math.min(base.length(), maxBaseLength))
                .replaceAll("-+$", "") + "-" + suffix;
    }
}
