package co.com.repu.model.user;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class UserAddress {
    private UUID id;
    private UUID userId;
    private String name;
    private String fullAddress;
    private String city;
    private String postalCode;
    private Boolean primary;
    private Double latitude;
    private Double longitude;
    private String deliveryNotes;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
