package co.automationia.r2dbc.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("pago_transaccion")
public class PaymentTransactionEntity {
    @Id
    private Long id;

    @Column("wompi_transaccion_id")
    private String wompiTransactionId;

    @Column("referencia")
    private String reference;

    @Column("tipo_pago")
    private String paymentType;

    @Column("entidad_id")
    private Long entityId;

    @Column("empresa_id")
    private Long companyId;

    @Column("monto_centavos")
    private Long amountInCents;

    @Column("moneda")
    private String currency;

    @Column("metodo_pago_tipo")
    private String paymentMethodType;

    @Column("token_tarjeta")
    private String cardToken;

    @Column("cuotas")
    private Integer installments;

    @Column("estado")
    private String status;

    @Column("mensaje_estado")
    private String statusMessage;

    @Column("codigo_respuesta_procesador")
    private String processorResponseCode;

    @Column("creado_en")
    private LocalDateTime createdAt;

    @Column("actualizado_en")
    private LocalDateTime updatedAt;
}