package co.com.repu.r2dbc;

import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionAuthenticationService {

    private final DatabaseClient databaseClient;

    public Mono<SessionPrincipal> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Mono.empty();
        }
        return databaseClient.sql("""
                SELECT u.id_usuario, u.rol_sistema
                FROM sesiones_usuario s
                JOIN usuarios u ON u.id_usuario = s.id_usuario
                WHERE s.token_sesion_hash = :tokenHash
                  AND s.esta_activa = TRUE
                  AND s.expira_en > CURRENT_TIMESTAMP
                  AND u.activo = TRUE
                """)
                .bind("tokenHash", hash(rawToken))
                .map((row, metadata) -> new SessionPrincipal(
                        row.get("id_usuario", UUID.class),
                        row.get("rol_sistema", String.class)))
                .one();
    }

    private String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("No se pudo validar la sesión.", exception);
        }
    }

    public record SessionPrincipal(UUID userId, String role) {
    }
}
