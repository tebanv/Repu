package co.automationia.api.checkout;

import co.automationia.api.model.response.ApiResponse;
import co.automationia.model.payment.checkout.PrepareCheckoutRequest;
import co.automationia.usecase.payment.wompi.PrepareCheckoutUseCase;
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
public class CheckoutHandler {

    private final PrepareCheckoutUseCase prepareCheckoutUseCase;

    public Mono<ServerResponse> prepare(ServerRequest request) {
        return request.bodyToMono(PrepareCheckoutRequest.class)
                .doOnNext(req ->
                        log.info("Preparando checkout para request: {}", req)
                )
                .flatMap(prepareCheckoutUseCase::execute)
                .flatMap(resp ->
                        ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(ApiResponse.success(resp))
                )
                .onErrorResume(ex -> handleError("Error preparando checkout", ex));
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