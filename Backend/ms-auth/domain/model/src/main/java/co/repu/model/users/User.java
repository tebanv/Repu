package co.repu.model.users;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class User {
    private UUID id;
    private String name;
    private String lastName;
    private String email;
    private String numberMobile;
    private String password;
    private String role;
    private Boolean status;
    private Object attributesUser;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean isNew;

    public String getFirstName() {
        return this.name;
    }

    public void setFirstName(String firstName) {
        this.name = firstName;
    }

    public String getPhone() {
        return this.numberMobile;
    }

    public void setPhone(String phone) {
        this.numberMobile = phone;
    }

    public Map<String, Object> getProfileAttributes() {
        if (this.attributesUser instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return null;
    }

    public void setProfileAttributes(Map<String, Object> profileAttributes) {
        this.attributesUser = profileAttributes;
    }
}
