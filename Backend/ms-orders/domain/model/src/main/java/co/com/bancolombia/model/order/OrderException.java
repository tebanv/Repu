package co.com.bancolombia.model.order;

public final class OrderException extends RuntimeException {
    private final String code;
    private final int status;

    public OrderException(String code, String message, int status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String code() {
        return code;
    }

    public int status() {
        return status;
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

    public static OrderException forbidden(String code, String message) {
        return new OrderException(code, message, 403);
    }
}
