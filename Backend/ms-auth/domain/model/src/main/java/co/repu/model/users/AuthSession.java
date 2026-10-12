package co.repu.model.users;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthSession {
    private User user;
    private Session session;
    private String rawToken;
    private long expiresInSeconds;
}
