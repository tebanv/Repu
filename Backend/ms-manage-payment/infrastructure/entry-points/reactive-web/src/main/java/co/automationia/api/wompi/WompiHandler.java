package co.automationia.api.wompi;

import co.automationia.api.model.request.CreatePaymentRequest;
import co.automationia.api.model.request.TokenizeCardRequest;
import co.automationia.api.model.response.ApiResponse;
import co.automationia.model.payment.PaymentTransaction;
import co.automationia.usecase.payment.wompi.CreatePaymentUseCase;
import co.automationia.usecase.payment.wompi.GetAcceptanceTokenUseCase;
import co.automationia.usecase.payment.wompi.GetPaymentStatusUseCase;
import co.automationia.usecase.payment.wompi.TokenizeCardUseCase;
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
public class WompiHandler {

    private final CreatePaymentUseCase createPaymentUseCase;
    private final TokenizeCardUseCase tokenizeCardUseCase;
    private final GetPaymentStatusUseCase getPaymentStatusUseCase;
    private final GetAcceptanceTokenUseCase getAcceptanceTokenUseCase;

    public Mono<ServerResponse> create(ServerRequest request) {
        return request.bodyToMono(CreatePaymentRequest.class)
                .doOnNext(dto -> log.info("Iniciando creación de pago"))
                .flatMap(dto -> {
                    if (dto.getToken() == null || dto.getToken().isBlank()) {
                        return handleError("El token de tarjeta es obligatorio",
                                new IllegalArgumentException("Token requerido"));
                    }

                    PaymentTransaction tx = buildPaymentTransaction(dto);

                    return getAcceptanceTokenUseCase.execute()
                            .flatMap(acc ->
                                    createPaymentUseCase.execute(tx, acc.getAcceptanceToken())
                            );
                })
                .flatMap(saved ->
                        ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(ApiResponse.success(saved))
                )
                .onErrorResume(ex -> handleError("Error creando pago", ex));
    }

    public Mono<ServerResponse> tokenizeCard(ServerRequest request) {
        return request.bodyToMono(TokenizeCardRequest.class)
                .doOnNext(dto -> log.info("Iniciando tokenización de tarjeta"))
                .flatMap(dto ->
                        tokenizeCardUseCase.execute(
                                dto.getNumber(),
                                dto.getCvc(),
                                dto.getExpMonth(),
                                dto.getExpYear(),
                                dto.getCardHolder()
                        )
                )
                .flatMap(token ->
                        ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(ApiResponse.success(token))
                )
                .onErrorResume(ex -> handleError("Error tokenizando tarjeta", ex));
    }

    public Mono<ServerResponse> getWompiStatus(ServerRequest request) {
        String wompiId = request.pathVariable("wompiId");
        log.info("Consultando estado de transacción externa");

        return getPaymentStatusUseCase.execute(wompiId)
                .flatMap(status ->
                        ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(ApiResponse.success(status))
                )
                .onErrorResume(ex -> handleError("Error consultando estado de la transacción", ex));
    }

    private PaymentTransaction buildPaymentTransaction(CreatePaymentRequest dto) {
        return PaymentTransaction.builder()
                .amountInCents(dto.getAmountInCents())
                .currency(dto.getCurrency())
                .reference(dto.getReference())
                .paymentMethodType(dto.getPaymentMethodType())
                .installments(dto.getInstallments())
                .token(dto.getToken())
                .customerEmail(dto.getCustomerEmail())
                .entityId(dto.getEntityId())
                .companyId(dto.getCompanyId())
                .build();
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