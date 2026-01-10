package co.com.repu.companies.r2dbc.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("empresas")
public class CompanyEntity implements Persistable<UUID> {
    @Id
    @Column("id_empresa")
    private UUID id;

    @Column("id_usuario_propietario")
    private UUID userIdOwner;

    @Column("razon_social")
    private String name;

    @Column("nit_identificacion")
    private String taxId;

    @Column("logo_url")
    private String logoUrl;

    @Column("descripcion_tienda")
    private String description;

    // Postgres JSONB requiere configuración especial de R2DBC o convertir a String/Map
    // Por simplicidad inicial, R2DBC a veces lo maneja como String si no hay converter
    @Column("configuracion_operativa")
    private Json operationalConfig;

    @Column("direccion_fisica")
    private String address;

    @Column("latitud")
    private Double latitude;

    @Column("longitud")
    private Double longitude;

    @Column("calificacion_promedio")
    private Double rating;

    @Column("activo")
    private Boolean active;

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
