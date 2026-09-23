package co.repu.security;
import co.repu.model.users.gateways.SecurityGateway;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SecurityAdapter implements SecurityGateway {

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    @Override
    public String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }

    @Override
    public boolean validatePassword(String cleanPassword, String hashStoredPassword) {

        return passwordEncoder.matches(cleanPassword, hashStoredPassword);
    }

}
