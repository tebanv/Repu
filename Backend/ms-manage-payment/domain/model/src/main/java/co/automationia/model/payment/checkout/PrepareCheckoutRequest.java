package co.automationia.model.payment.checkout;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class PrepareCheckoutRequest {
    private Long amountInCents;
    private String currency;
    private String customerEmail;
    private Long entityId;
    private Long companyId;
    private String redirectUrl;
    private String expirationTime;
}
