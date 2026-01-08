package co.automationia.api.model.request;

import lombok.Data;

@Data
public class CreatePaymentRequest {

    private Long amountInCents;
    private String currency;
    private String reference;
    private String paymentMethodType;
    private Integer installments;
    private String token;
    private String customerEmail;
    private Long entityId;
    private Long companyId;
    private String acceptanceToken;
}
