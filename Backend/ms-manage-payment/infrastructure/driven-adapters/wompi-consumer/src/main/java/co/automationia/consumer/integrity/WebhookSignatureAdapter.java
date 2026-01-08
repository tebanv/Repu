package co.automationia.consumer.integrity;

import co.automationia.model.payment.gateways.WebhookSignatureGateway;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Slf4j
@Component
public class WebhookSignatureAdapter implements WebhookSignatureGateway {

    @Value("${adapters.wompi.event-secret}")
    private String eventSecret;

    @Override
    public boolean isValid(
            long timestamp,
            String transactionId,
            String status,
            long amountInCents,
            String receivedChecksum
    ) {
        try {
            if (transactionId == null || status == null || receivedChecksum == null) {
                log.warn("Webhook WOMPI inválido: datos incompletos");
                return false;
            }

            String payload =
                    transactionId +
                            status +
                            amountInCents +
                            timestamp +
                            eventSecret;

            String calculated = sha256(payload);

            boolean valid = MessageDigest.isEqual(
                    calculated.getBytes(StandardCharsets.UTF_8),
                    receivedChecksum.getBytes(StandardCharsets.UTF_8)
            );

            if (!valid) {
                log.warn("Firma WOMPI inválida. Esperada={}, Calculada={}",
                        receivedChecksum,
                        calculated
                );
            }

            return valid;

        } catch (Exception e) {
            log.error("Error validando firma de webhook WOMPI", e);
            return false;
        }
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
