package co.automationia.consumer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class WompiTransactionResponse {

    private DataObject data;

    @Data
    public static class DataObject {

        private String id;

        @JsonProperty("amount_in_cents")
        private Long amountInCents;

        private String reference;

        private String currency;

        @JsonProperty("payment_method_type")
        private String paymentMethodType;

        @JsonProperty("status")
        private String status;

        @JsonProperty("status_message")
        private String statusMessage;

        @JsonProperty("created_at")
        private String createdAt;

        @JsonProperty("updated_at")
        private String updatedAt;

        @JsonProperty("payment_method")
        private PaymentMethod paymentMethod;
    }

    @Data
    public static class PaymentMethod {

        @JsonProperty("extra")
        private Extra extra;

        private Integer installments;
    }

    @Data
    public static class Extra {

        @JsonProperty("processor_response_code")
        private String processorResponseCode;

        @JsonProperty("last_four")
        private String lastFour;

        private String name;
        private String brand;
    }
}
