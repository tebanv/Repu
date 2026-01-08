package co.delivery.model.clients;
import lombok.*;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class Client {
    private Integer id;
    private String name;
    private String email;
    private String password;
    private String role;
    private String status;
    private Integer companyId;
}
