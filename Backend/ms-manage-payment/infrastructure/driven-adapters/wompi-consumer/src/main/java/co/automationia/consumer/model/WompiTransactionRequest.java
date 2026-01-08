package co.automationia.consumer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WompiTransactionRequest {

    @JsonProperty("amount_in_cents")
    private Long amountInCents;

    private String currency;

    private String reference;

    @JsonProperty("customer_email")
    private String customerEmail;

    @JsonProperty("payment_method_type")
    private String paymentMethodType;

    @JsonProperty("payment_method")
    private PaymentMethod paymentMethod;

    @JsonProperty("acceptance_token")
    private String acceptanceToken;

    @JsonProperty("signature")
    private String signature;


    @Data
    @Builder
    public static class PaymentMethod {
        private String type;
        private Integer installments;
        private String token;
    }
}
