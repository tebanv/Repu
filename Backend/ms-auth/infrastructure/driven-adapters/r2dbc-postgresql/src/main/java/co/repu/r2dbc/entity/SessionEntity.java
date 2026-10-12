package co.repu.r2dbc.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder(toBuilder = true)
@AllArgsConstructor
@NoArgsConstructor
@Table("sesiones_usuario")
public class SessionEntity implements Persistable<UUID> {

    @Id
    @Column("id_sesion")
    private UUID sessionId;

    @Column("id_usuario")
    private UUID userId;

    @Column("token_sesion_hash")
    private String tokenHash;

    @Column("id_empresa_activa")
    private UUID activeCompanyId;

    @Column("direccion_ip")
    private String ipAddress;

    @Column("agente_usuario")
    private String userAgent;

    @Column("dispositivo_info")
    private String deviceInfo;

    @Column("esta_activa")
    private Boolean active;

    @Column("expira_en")
    private LocalDateTime expiresAt;

    @Column("fecha_creacion")
    private LocalDateTime createdAt;

    @Column("ultimo_acceso")
    private LocalDateTime lastAccess;

    @Transient
    @Builder.Default
    private boolean isNew = false;

    @Override
    public UUID getId() {
        return sessionId;
    }

    @Override
    public boolean isNew() {
        return this.isNew || sessionId == null;
    }
}
