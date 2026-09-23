package co.repu.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class UserSession {
    private UUID sessionId;
    private String deviceInfo;
    private String ipAddress;
    private LocalDateTime lastAccess;
    private LocalDateTime expiresAt;
}