package co.automationia.api.model.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class WompiWebhook {

    private EventData data;

    private Long timestamp;

    private Signature signature;

    @Data
    public static class EventData {
        private Transaction transaction;
    }

    @Data
    public static class Transaction {

        private String id;
        private String reference;
        private String status;

        @JsonProperty("status_message")
        private String statusMessage;

        @JsonProperty("amount_in_cents")
        private Long amountInCents;
    }

    @Data
    public static class Signature {

        private String checksum;
    }
}