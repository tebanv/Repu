package co.automationia.api.model.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private T data;
    private String error;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message("OK")
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> error(String msg) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(msg)
                .error(msg)
                .build();
    }
}