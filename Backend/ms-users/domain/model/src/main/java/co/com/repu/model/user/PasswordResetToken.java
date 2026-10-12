package co.com.repu.model.user;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {
    private UUID id;
    private UUID userId;
    private String codeHash;
    private LocalDateTime expiresAt;
    private Integer failedAttempts;
    private Integer maxAttempts;
}
