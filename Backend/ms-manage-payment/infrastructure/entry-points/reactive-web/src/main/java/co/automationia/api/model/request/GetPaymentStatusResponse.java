package co.automationia.api.model.request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GetPaymentStatusResponse {
    private String wompiTransactionId;
    private String status;
    private String statusMessage;
    private String processorResponseCode;
}