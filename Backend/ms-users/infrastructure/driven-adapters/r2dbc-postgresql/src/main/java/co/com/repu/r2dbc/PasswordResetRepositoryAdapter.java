package co.com.repu.r2dbc;

import co.com.repu.model.user.PasswordResetToken;
import co.com.repu.model.user.gateways.PasswordResetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class PasswordResetRepositoryAdapter implements PasswordResetRepository {

    private final DatabaseClient databaseClient;

    @Override
    public Mono<Void> invalidateActiveTokens(UUID userId) {
        return databaseClient.sql("""
                UPDATE repu.tokens_recuperacion_contrasena
                SET usado = TRUE, usado_en = CURRENT_TIMESTAMP
                WHERE id_usuario = $1 AND usado = FALSE
                """)
                .bind(0, userId)
                .fetch().rowsUpdated().then();
    }

    @Override
    public Mono<PasswordResetToken> create(UUID userId, String codeHash,
                                           int expirationMinutes, int maxAttempts) {
        return databaseClient.sql("""
                INSERT INTO repu.tokens_recuperacion_contrasena
                    (id_usuario, codigo_hash, expira_en, max_intentos)
                VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute'), $4)
                RETURNING id_token, id_usuario, codigo_hash, expira_en,
                          intentos_fallidos, max_intentos
                """)
                .bind(0, userId)
                .bind(1, codeHash)
                .bind(2, expirationMinutes)
                .bind(3, maxAttempts)
                .map((row, metadata) -> PasswordResetToken.builder()
                        .id(row.get("id_token", UUID.class))
                        .userId(row.get("id_usuario", UUID.class))
                        .codeHash(row.get("codigo_hash", String.class))
                        .expiresAt(row.get("expira_en", LocalDateTime.class))
                        .failedAttempts(row.get("intentos_fallidos", Integer.class))
                        .maxAttempts(row.get("max_intentos", Integer.class))
                        .build())
                .one();
    }

    @Override
    public Mono<PasswordResetToken> findValid(UUID userId, String codeHash) {
        return databaseClient.sql("""
                SELECT id_token, id_usuario, codigo_hash, expira_en,
                       intentos_fallidos, max_intentos
                FROM repu.tokens_recuperacion_contrasena
                WHERE id_usuario = $1 AND codigo_hash = $2
                  AND usado = FALSE AND expira_en > CURRENT_TIMESTAMP
                  AND intentos_fallidos < max_intentos
                """)
                .bind(0, userId)
                .bind(1, codeHash)
                .map((row, metadata) -> PasswordResetToken.builder()
                        .id(row.get("id_token", UUID.class))
                        .userId(row.get("id_usuario", UUID.class))
                        .codeHash(row.get("codigo_hash", String.class))
                        .expiresAt(row.get("expira_en", LocalDateTime.class))
                        .failedAttempts(row.get("intentos_fallidos", Integer.class))
                        .maxAttempts(row.get("max_intentos", Integer.class))
                        .build())
                .one();
    }

    @Override
    public Mono<PasswordResetToken> findActiveByUserId(UUID userId) {
        return databaseClient.sql("""
                SELECT id_token, id_usuario, codigo_hash, expira_en,
                       intentos_fallidos, max_intentos
                FROM repu.tokens_recuperacion_contrasena
                WHERE id_usuario = $1 AND usado = FALSE
                  AND expira_en > CURRENT_TIMESTAMP
                  AND intentos_fallidos < max_intentos
                """)
                .bind(0, userId)
                .map((row, metadata) -> PasswordResetToken.builder()
                        .id(row.get("id_token", UUID.class))
                        .userId(row.get("id_usuario", UUID.class))
                        .codeHash(row.get("codigo_hash", String.class))
                        .expiresAt(row.get("expira_en", LocalDateTime.class))
                        .failedAttempts(row.get("intentos_fallidos", Integer.class))
                        .maxAttempts(row.get("max_intentos", Integer.class))
                        .build())
                .one();
    }

    @Override
    public Mono<Boolean> incrementFailedAttempts(UUID tokenId) {
        return databaseClient.sql("""
                UPDATE repu.tokens_recuperacion_contrasena
                SET intentos_fallidos = intentos_fallidos + 1
                WHERE id_token = $1 AND usado = FALSE
                """)
                .bind(0, tokenId)
                .fetch().rowsUpdated()
                .map(rows -> rows > 0);
    }

    @Override
    public Mono<Void> updatePasswordAndInvalidateSessions(UUID userId, String passwordHash, UUID tokenId) {
        return databaseClient.sql("""
                WITH token_consumido AS (
                    UPDATE repu.tokens_recuperacion_contrasena
                    SET usado = TRUE, usado_en = CURRENT_TIMESTAMP
                    WHERE id_token = $1 AND id_usuario = $2
                      AND usado = FALSE AND expira_en > CURRENT_TIMESTAMP
                    RETURNING id_usuario
                )
                UPDATE repu.usuarios
                SET hash_contrasena = $3, fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id_usuario IN (SELECT id_usuario FROM token_consumido)
                """)
                .bind(0, tokenId)
                .bind(1, userId)
                .bind(2, passwordHash)
                .fetch().rowsUpdated()
                .flatMap(rows -> rows == 0
                        ? Mono.error(new IllegalArgumentException("Código inválido o expirado."))
                        : databaseClient.sql("""
                            UPDATE repu.sesiones_usuario
                            SET esta_activa = FALSE
                            WHERE id_usuario = $1 AND esta_activa = TRUE
                            """)
                        .bind(0, userId)
                        .fetch().rowsUpdated())
                .then();
    }
}
