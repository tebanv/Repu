package co.repu.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class AuthSessionResponse {
    private boolean authenticated;
    private UUID userId;
    private String role;
    private UUID activeCompanyId;
    private String accessToken;
    private Long expiresInSeconds;
}
