package co.automationia.model.payment.gateways;

import reactor.core.publisher.Mono;

public interface IntegritySignatureGateway {

    Mono<String> generate(
            String reference,
            Long amountInCents,
            String currency,
            String expirationTime
    );
}
