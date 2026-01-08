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
public class CardToken {
    private String id;
    private String brand;
    private String name;
    private String lastFour;
    private String bin;
    private String expMonth;
    private String expYear;
    private String cardHolder;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
