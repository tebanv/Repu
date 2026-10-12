package co.automationia.consumer.integrity;

import co.automationia.model.payment.gateways.IntegritySignatureGateway;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Slf4j
@Component
public class IntegritySignatureAdapter implements IntegritySignatureGateway {

    @Value("${adapters.wompi.integrity-secret}")
    private String integritySecret;

    @Override
    public Mono<String> generate(
            String reference,
            Long amountInCents,
            String currency,
            String expirationTime
    ) {
        if (reference == null || amountInCents == null || currency == null) {
            log.warn("Parámetros inválidos para generación de firma de integridad");
            return Mono.error(new IllegalArgumentException("Parámetros inválidos para firma de integridad"));
        }

        return Mono.fromSupplier(() -> buildRaw(reference, amountInCents, currency, expirationTime))
                .map(this::sha256)
                .doOnError(ex ->
                        log.error("Error técnico al generar firma de integridad", ex)
                );
    }

    private String buildRaw(
            String reference,
            Long amountInCents,
            String currency,
            String expirationTime
    ) {
        return (expirationTime == null || expirationTime.isBlank())
                ? reference + amountInCents + currency + integritySecret
                : reference + amountInCents + currency + expirationTime + integritySecret;
    }

    private String sha256(String raw) {
        try {
            log.warn("WOMPI RAW SIGNATURE STRING = [{}]", raw);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }

            return hex.toString();

        } catch (Exception ex) {
            // Error técnico real: algoritmo / JVM / provider
            throw new IllegalStateException("No fue posible generar la firma de integridad", ex);
        }
    }
}