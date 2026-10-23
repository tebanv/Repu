package co.com.repu.companies.api;

import co.com.repu.companies.model.company.PersistenceException;
import co.com.repu.companies.model.company.CompanyAccessDeniedException;
import co.com.repu.companies.model.company.CompanySlugAlreadyExistsException;
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

        if (error instanceof CompanySlugAlreadyExistsException) {
            status = HttpStatus.CONFLICT;
            code = "COMPANY_SLUG_ALREADY_EXISTS";
            message = "El slug ya está en uso.";
        } else if (error instanceof CompanyAccessDeniedException) {
            status = HttpStatus.FORBIDDEN;
            code = "COMPANY_ACCESS_DENIED";
            message = "No tienes permiso para modificar esta empresa.";
        } else if (error instanceof PersistenceException persistenceException) {
            switch (persistenceException.getKind()) {
                case DUPLICATE_TAX_ID -> {
                    status = HttpStatus.CONFLICT;
                    code = "COMPANY_TAX_ID_ALREADY_EXISTS";
                    message = "El NIT ya está registrado.";
                }
                case DUPLICATE_SLUG -> {
                    status = HttpStatus.CONFLICT;
                    code = "COMPANY_SLUG_ALREADY_EXISTS";
                    message = "El slug ya está en uso.";
                }
                case DUPLICATE -> {
                    status = HttpStatus.CONFLICT;
                    code = "DUPLICATE_RESOURCE";
                    message = "Ya existe una empresa con esos datos.";
                }
                case INVALID_REFERENCE -> {
                    status = HttpStatus.CONFLICT;
                    code = "INVALID_REFERENCE";
                    message = "No se puede guardar porque una entidad relacionada no existe o está en uso.";
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
