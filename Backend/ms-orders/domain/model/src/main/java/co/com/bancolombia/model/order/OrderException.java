package co.com.bancolombia.model.order;

import java.util.Map;

public final class OrderException extends RuntimeException {
    private final String code;
    private final int status;
    private final Map<String, Object> details;

    public OrderException(String code, String message, int status) {
        this(code, message, status, Map.of());
    }

    public OrderException(String code, String message, int status, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public String code() {
        return code;
    }

    public int status() {
        return status;
    }

    public Map<String, Object> details() {
        return details;
    }

    public static OrderException notFound(String code, String message) {
        return new OrderException(code, message, 404);
    }

    public static OrderException invalid(String code, String message) {
        return new OrderException(code, message, 400);
    }

    public static OrderException conflict(String code, String message) {
        return new OrderException(code, message, 409);
    }

    public static OrderException conflict(String code, String message, Map<String, Object> details) {
        return new OrderException(code, message, 409, details);
    }

    public static OrderException forbidden(String code, String message) {
        return new OrderException(code, message, 403);
    }
}
