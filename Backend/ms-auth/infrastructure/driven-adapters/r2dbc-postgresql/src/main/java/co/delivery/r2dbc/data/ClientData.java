package co.delivery.r2dbc.data;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Builder(toBuilder = true)
@AllArgsConstructor
@NoArgsConstructor
@Table("clientes")
public class ClientData {

    @Id
    private Integer id;

    @Column("nombre")
    private String name;

    @Column("celular")
    private String numberMobile;

    @Column("correo_electronico")
    private String email;

    @Column("contrasena")
    private String password;

    @Column("estado")
    private String status;

    @Column("empresa_id")
    private Integer companyId;

    @Column("session_id")
    private String sessionId;
}
