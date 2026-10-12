package co.automationia.model.payment.checkout;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class PrepareCheckoutResponse {
    private String publicKey;
    private String reference;
    private Long amountInCents;
    private String currency;
    private String signature;
    private String redirectUrl;
    private String expirationTime;
}
