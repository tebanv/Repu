package co.repu.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class UserProfile {
    private UUID id;
    private String email;
    private String role;
    private String firstName;
    private String lastName;
    private String phone;
    private Map<String, Object> profileAttributes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Boolean status;
}