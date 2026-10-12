package co.automationia.api.model.request;

import lombok.Data;

@Data
public class TokenizeCardRequest {

    private String number;
    private String cvc;
    private String expMonth;
    private String expYear;
    private String cardHolder;
}
