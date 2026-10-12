package co.automationia.model.payment.gateways;

public interface WebhookSignatureGateway {

    boolean isValid(
            long timestamp,
            String transactionId,
            String status,
            long amountInCents,
            String receivedChecksum
    );
}
