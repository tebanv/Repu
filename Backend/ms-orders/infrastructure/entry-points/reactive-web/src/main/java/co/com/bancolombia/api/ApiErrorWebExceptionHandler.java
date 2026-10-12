package co.com.bancolombia.api;

import co.com.bancolombia.model.order.OrderException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebInputException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.Exceptions;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import org.springframework.core.codec.DecodingException;

@Component
@Order(-2)
public class ApiErrorWebExceptionHandler implements WebExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(ApiErrorWebExceptionHandler.class);

    private final ObjectMapper mapper;

    public ApiErrorWebExceptionHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable failure) {
        Throwable cause = Exceptions.unwrap(failure);
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(cause);
        }
        boolean badRequest = cause instanceof ServerWebInputException || cause instanceof DecodingException
                || cause instanceof IllegalArgumentException;
        int status = cause instanceof OrderException orderException ? orderException.status() : badRequest ? 400 : 500;
        String code = cause instanceof OrderException orderException ? orderException.code()
                : badRequest ? "INVALID_REQUEST" : "INTERNAL_ERROR";
        String message;
        if (cause instanceof OrderException orderException) {
            message = orderException.getMessage();
        } else if (badRequest) {
            message = "El cuerpo o los parámetros de la solicitud no son válidos.";
        } else {
            LOGGER.error("Unhandled error while processing request {}", exchange.getRequest().getPath(), cause);
            message = "Ocurrió un error inesperado al procesar la solicitud.";
        }

        byte[] body = mapper.writeValueAsBytes(new ErrorResponse(code, message, Map.of()));
        exchange.getResponse().setStatusCode(HttpStatusCode.valueOf(status));
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    public record ErrorResponse(String code, String message, Map<String, Object> details) {
    }
}
