package co.automationia.api.wompi;

import co.automationia.api.model.request.WompiWebhook;
import co.automationia.model.payment.gateways.WebhookSignatureGateway;
import co.automationia.usecase.payment.wompi.ProcessWompiWebhookUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class WompiWebhookHandler {

    private final ProcessWompiWebhookUseCase processWompiWebhookUseCase;
    private final WebhookSignatureGateway webhookSignatureGateway;
    private final ObjectMapper objectMapper;

    public Mono<ServerResponse> handle(ServerRequest request) {

        return request.bodyToMono(String.class)
                .doOnNext(body -> {
                    log.info("=== WEBHOOK WOMPI RECIBIDO ===");
                    log.info("Raw body: {}", body);
                })
                .flatMap(this::parse)
                .flatMap(event -> {

                    var tx = event.getData().getTransaction();

                    boolean valid = webhookSignatureGateway.isValid(
                            event.getTimestamp(),
                            tx.getId(),
                            tx.getStatus(),
                            tx.getAmountInCents(),
                            event.getSignature().getChecksum()
                    );

                    if (!valid) {
                        log.warn("Webhook WOMPI con firma inválida");
                        // IMPORTANTE: responder 200 para evitar reintentos
                        return ok();
                    }

                    log.info(
                            "Webhook WOMPI válido. ref={}, status={}",
                            tx.getReference(),
                            tx.getStatus()
                    );

                    return processWompiWebhookUseCase.execute(
                            tx.getReference(),
                            tx.getStatus(),
                            tx.getStatusMessage()
                    ).then(ok());
                })
                .onErrorResume(ex -> {
                    log.error("Error procesando webhook WOMPI", ex);
                    return ok();
                });
    }

    private Mono<WompiWebhook> parse(String json) {
        return Mono.fromCallable(() ->
                objectMapper.readValue(json, WompiWebhook.class)
        );
    }

    private Mono<ServerResponse> ok() {
        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"ok\":true}");
    }
}