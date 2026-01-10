package co.repu.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class RegisterRequest {
    private String name;
    private String lastName;
    private String email;
    private String password;
    private String numberMobile;
    private String role;
    private Map<String, Object> attributesUser;
}
