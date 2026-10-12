package co.com.bancolombia.model.auth;

public record SessionCredential(String value, Type type) {
    public enum Type {
        BEARER,
        COOKIE
    }
}
