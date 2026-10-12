package co.automationia.consumer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class WompiCardTokenResponse {

    private DataObject data;

    @Data
    public static class DataObject {

        private String id;

        private String brand;

        private String name;

        @JsonProperty("last_four")
        private String lastFour;

        private String bin;

        @JsonProperty("exp_month")
        private String expMonth;

        @JsonProperty("exp_year")
        private String expYear;

        @JsonProperty("card_holder")
        private String cardHolder;

        @JsonProperty("created_at")
        private String createdAt;

        @JsonProperty("expires_at")
        private String expiresAt;
    }
}
