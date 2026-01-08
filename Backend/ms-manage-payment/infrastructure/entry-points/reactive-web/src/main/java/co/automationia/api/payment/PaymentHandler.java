package co.automationia.api.payment;

import co.automationia.api.model.response.ApiResponse;
import co.automationia.usecase.payment.core.FindPaymentByIdUseCase;
import co.automationia.usecase.payment.core.FindPaymentByReferenceUseCase;
import co.automationia.usecase.payment.core.ListPaymentsByStatusUseCase;
import co.automationia.usecase.payment.core.UpdatePaymentTransactionStatusUseCase;
import co.automationia.usecase.payment.wompi.GetPaymentStatusUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentHandler {

    private final FindPaymentByIdUseCase findPaymentByIdUseCase;
    private final FindPaymentByReferenceUseCase findPaymentByReferenceUseCase;
    private final ListPaymentsByStatusUseCase listPaymentsByStatusUseCase;
    private final UpdatePaymentTransactionStatusUseCase updatePaymentTransactionStatusUseCase;
    private final GetPaymentStatusUseCase getPaymentStatusUseCase;

    public Mono<ServerResponse> getById(ServerRequest request) {
        Long id;
        try {
            id = Long.parseLong(request.pathVariable("id"));
        } catch (Exception e) {
            return handleError("El id proporcionado no es válido", e);
        }

        log.info("Consultando pago por id");

        return findPaymentByIdUseCase.execute(id)
                .flatMap(data -> ok(ApiResponse.success(data)))
                .onErrorResume(ex -> handleError("Error consultando pago por id", ex));
    }

    public Mono<ServerResponse> getByReference(ServerRequest request) {
        String reference = request.pathVariable("reference");

        log.info("Consultando pago por referencia");

        return findPaymentByReferenceUseCase.execute(reference)
                .flatMap(data -> ok(ApiResponse.success(data)))
                .onErrorResume(ex -> handleError("Error consultando pago por referencia", ex));
    }

    public Mono<ServerResponse> listByStatus(ServerRequest request) {
        String status = request.pathVariable("status");

        log.info("Listando pagos por estado");

        return listPaymentsByStatusUseCase.execute(status)
                .collectList()
                .flatMap(list -> ok(ApiResponse.success(list)))
                .onErrorResume(ex -> handleError("Error listando pagos por estado", ex));
    }

    public Mono<ServerResponse> updateStatus(ServerRequest request) {
        Long id;
        String status = request.pathVariable("status");

        try {
            id = Long.parseLong(request.pathVariable("id"));
        } catch (Exception e) {
            return handleError("El id proporcionado no es válido", e);
        }

        log.info("Actualizando estado del pago");

        return updatePaymentTransactionStatusUseCase.execute(id, status, null, null)
                .flatMap(updated ->
                        ok(ApiResponse.builder()
                                .success(true)
                                .message("Estado actualizado correctamente")
                                .data(updated)
                                .build())
                )
                .onErrorResume(ex -> handleError("Error actualizando estado del pago", ex));
    }

    public Mono<ServerResponse> syncWithWompi(ServerRequest request) {
        String wompiId = request.pathVariable("wompiId");

        log.info("Sincronizando estado del pago con proveedor externo");

        return getPaymentStatusUseCase.execute(wompiId)
                .flatMap(data ->
                        ok(ApiResponse.builder()
                                .success(true)
                                .message("Estado sincronizado correctamente")
                                .data(data)
                                .build())
                )
                .onErrorResume(ex -> handleError("Error sincronizando estado del pago", ex));
    }

    private Mono<ServerResponse> ok(Object body) {
        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body);
    }

    private Mono<ServerResponse> handleError(String message, Throwable ex) {
        log.error(message, ex);

        return ServerResponse.badRequest()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(
                        ApiResponse.builder()
                                .success(false)
                                .message(message)
                                .error(ex.getMessage())
                                .build()
                );
    }
}