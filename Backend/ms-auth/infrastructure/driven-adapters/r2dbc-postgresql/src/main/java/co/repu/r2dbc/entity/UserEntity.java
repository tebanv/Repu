package co.repu.r2dbc.entity;

import io.r2dbc.postgresql.codec.Json;
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
@Table("usuarios")
public class UserEntity implements Persistable<UUID> {

    @Id
    @Column("id_usuario")
    private UUID id;

    @Column("nombres")
    private String name;

    @Column("apellidos")
    private String lastName;

    @Column("telefono_movil")
    private String numberMobile;

    @Column("correo_electronico")
    private String email;

    @Column("hash_contrasena")
    private String password;

    @Column("activo")
    private Boolean status;

    @Column("rol_sistema")
    private String role;

    @Column("atributos_perfil")
    private Json attributesUser;

    @Column("ultimo_login")
    private LocalDateTime lastLogin;

    @Column("fecha_creacion")
    private LocalDateTime createdAt;

    @Column("fecha_actualizacion")
    private LocalDateTime updatedAt;

// --- Lógica de Persistable ---

    @Transient // Este campo no va a la BD, es solo para lógica interna de Spring
    @Builder.Default
    private boolean isNew = false;

    @Override
    public boolean isNew() {
        return this.isNew || id == null; // Si marcamos isNew=true, forzamos INSERT
    }
}
