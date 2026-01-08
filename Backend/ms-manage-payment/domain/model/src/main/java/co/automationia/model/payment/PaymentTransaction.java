package co.automationia.model.payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class PaymentTransaction {
    private Long id;
    private String wompiTransactionId;
    private String reference;
    private String paymentType;
    private Long entityId;
    private Long companyId;
    private Long amountInCents;
    private String currency;
    private String paymentMethodType;
    private String customerEmail;
    private String token;
    private Integer installments;
    private String status;
    private String statusMessage;
    private String processorResponseCode;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}