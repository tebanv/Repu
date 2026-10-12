package co.com.repu.companies.model.company;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;


@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Company {
    private String id;               // UUID
    private UUID userIdOwner;      // Dueño de la empresa
    private String name;             // Razón Social
    private String taxId;            // NIT
    private String logoUrl;
    private String description;

    // Configuración operativa (JSONB en BD)
    // Usamos Object o un Map para no acoplarnos a librerías de JSON aquí
    private Object operationalConfig;

    private String address;
    private Double latitude;
    private Double longitude;
    private Double rating;           // calificacion_promedio

    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
