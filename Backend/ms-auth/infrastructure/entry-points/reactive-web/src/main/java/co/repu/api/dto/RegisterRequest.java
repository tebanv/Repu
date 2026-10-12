package co.repu.api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
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
    @JsonAlias({"name", "firstName"})
    private String firstName;
    @JsonAlias({"lastName"})
    private String lastName;
    @JsonAlias({"email"})
    private String email;
    @JsonAlias({"password"})
    private String password;
    @JsonAlias({"phone", "numberMobile"})
    private String phone;
    @JsonAlias({"role"})
    private String role;
    @JsonAlias({"profileAttributes", "attributesUser"})
    private Map<String, Object> profileAttributes;

}
