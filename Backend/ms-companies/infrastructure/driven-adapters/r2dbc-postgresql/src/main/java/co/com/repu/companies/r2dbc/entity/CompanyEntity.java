package co.com.repu.companies.r2dbc.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("empresas")
public class CompanyEntity {
    @Id
    @Column("id_empresa")
    private String id;

    @Column("id_usuario_propietario")
    private String userIdOwner;

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
    private String operationalConfig;

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
}
