package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.util.Set;

@RequiredArgsConstructor
public class ProcessWompiWebhookUseCase {

    private static final Set<String> FINAL_STATUSES =
            Set.of("APPROVED", "DECLINED", "ERROR", "VOIDED");

    private final PaymentTransactionRepository repository;

    public Mono<Void> execute(String reference, String status, String statusMessage) {

        if (reference == null || reference.isBlank() || status == null) {
            return Mono.empty();
        }

        return repository.findByReference(reference)
                .flatMap(tx -> {
                    if (isFinal(tx.getStatus())) {
                        return Mono.empty();
                    }
                    return repository.updateStatus(
                            tx.getId(),
                            status,
                            statusMessage,
                            null
                    );
                })
                .then();
    }

    private boolean isFinal(String status) {
        return status != null && FINAL_STATUSES.contains(status);
    }
}