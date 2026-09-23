package co.repu.model.users;

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
public class Session {
    private UUID sessionId;
    private UUID userId;
    private String tokenHash;
    private UUID activeCompanyId;
    private String ipAddress;
    private String userAgent;
    private String deviceInfo;
    private Boolean active;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime lastAccess;
}
