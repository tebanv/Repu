package co.com.repu.r2dbc.entity;

import io.r2dbc.postgresql.codec.Json;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("productos")
public class ProductEntity implements Persistable<UUID> {

    @Id
    @Column("id_producto")
    private UUID id;

    @Column("id_empresa")
    private UUID companyId;

    @Column("id_categoria")
    private UUID categoryId;

    @Column("nombre")
    private String name;

    @Column("sku_referencia")
    private String sku;

    @Column("descripcion_corta")
    private String description;

    @Column("precio_base")
    private BigDecimal price;

    @Column("precio_oferta")
    private BigDecimal priceOffer;

    @Column("inventario_disponible")
    private Integer stock;

    @Column("caracteristicas_tecnicas")
    private Json attributes; // Tipo nativo R2DBC Postgres
    @Column("imagenes_urls")
    private Json images; // Tipo nativo R2DBC Postgres

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
        return isNew || id == null;
    }
}
