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
@Table("parametros_sistema")
public class SystemParameterEntity implements Persistable<UUID> {

    @Id
    @Column("id_parametro")
    private UUID id;

    @Column("codigo_clave")
    private String key;

    @Column("valor_configuracion")
    private Json configValue;

    @Column("descripcion")
    private String description;

    @Column("activo")
    private Boolean active;

    @Column("fecha_creacion")
    private LocalDateTime createdAt;

    @Column("fecha_actualizacion")
    private LocalDateTime updatedAt;

    @Transient
    @Builder.Default
    private boolean isNew = false;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}
