package co.automationia.consumer.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WompiCardTokenRequest {

    private String number;

    private String cvc;

    @JsonProperty("exp_month")
    private String expMonth;

    @JsonProperty("exp_year")
    private String expYear;

    @JsonProperty("card_holder")
    private String cardHolder;
}
