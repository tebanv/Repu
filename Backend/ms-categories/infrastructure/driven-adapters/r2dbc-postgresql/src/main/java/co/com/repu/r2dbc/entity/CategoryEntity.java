package co.com.repu.r2dbc.entity;

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
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("categorias")
public class CategoryEntity implements Persistable<UUID> {

    @Id
    @Column("id_categoria")
    private UUID id;

    @Column("id_categoria_padre") // Coincide con tu SQL
    private UUID parentId;

    @Column("nombre")
    private String name;

    @Column("descripcion")
    private String description;

    @Column("icono_url") // Coincide con tu SQL
    private String iconUrl;

    @Column("activo")
    private Boolean active;

    @Column("fecha_creacion")
    private LocalDateTime createdAt;

    @Column("fecha_actualizacion")
    private LocalDateTime updatedAt;

    // --- Lógica de Persistable ---
    @Transient
    @Builder.Default
    private boolean isNew = false;

    @Override
    public boolean isNew() {
        return isNew || id == null;
    }
}
