package co.com.repu.api;

import co.com.repu.model.category.PersistenceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebInputException;
import reactor.core.publisher.Mono;
import org.springframework.web.reactive.function.server.ServerResponse;

@Slf4j
public final class ApiErrorHandler {

    private ApiErrorHandler() {}

    public static Mono<ServerResponse> handle(Throwable error, String requestId) {
        HttpStatus status;
        String code;
        String message;

        if (error instanceof PersistenceException persistenceException) {
            switch (persistenceException.getKind()) {
                case DUPLICATE -> {
                    status = HttpStatus.CONFLICT;
                    code = "DUPLICATE_RESOURCE";
                    message = "Ya existe una categoría con esos datos.";
                }
                case INVALID_REFERENCE -> {
                    status = HttpStatus.CONFLICT;
                    code = "INVALID_REFERENCE";
                    message = "La categoría padre indicada no existe o no puede utilizarse.";
                }
                case INVALID_VALUE -> {
                    status = HttpStatus.BAD_REQUEST;
                    code = "INVALID_DATA";
                    message = "Uno o más valores no cumplen las restricciones de datos.";
                }
                case UNAVAILABLE -> {
                    status = HttpStatus.SERVICE_UNAVAILABLE;
                    code = "SERVICE_UNAVAILABLE";
                    message = "La base de datos no está disponible temporalmente.";
                }
                default -> {
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    code = "INTERNAL_ERROR";
                    message = "Ocurrió un error interno al procesar la solicitud.";
                }
            }
        } else if (error instanceof IllegalArgumentException || error instanceof ServerWebInputException) {
            status = HttpStatus.BAD_REQUEST;
            code = "INVALID_REQUEST";
            message = "La solicitud contiene datos inválidos.";
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            code = "INTERNAL_ERROR";
            message = "Ocurrió un error interno al procesar la solicitud.";
        }

        log.error("Error procesando solicitud, requestId: {}, status: {}",
                requestId, status.value(), error);
        return ServerResponse.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse(code, message, requestId));
    }

    public record ErrorResponse(String code, String message, String requestId) {}
}
