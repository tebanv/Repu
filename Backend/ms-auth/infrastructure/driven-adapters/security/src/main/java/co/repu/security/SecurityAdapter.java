package co.repu.security;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.User;
import io.jsonwebtoken.SignatureAlgorithm;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Log
@Component
public class SecurityAdapter implements SecurityGateway {

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    // CLAVE SECRETA: En producción esto DEBE venir de Vault/AWS Secrets Manager
    @Value("${security.jwt.secret}")
    private String secretKey;
    @Value("${security.jwt.expiration-minutes:60}")
    private long expirationMinutes;


    @Override
    public String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }

    @Override
    public boolean validatePassword(String cleanPassword, String hashStoredPassword) {

        return passwordEncoder.matches(cleanPassword, hashStoredPassword);
    }

    @Override
    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole());
        claims.put("lastname", user.getLastName());
        claims.put("name", user.getName());

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getEmail())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + (expirationMinutes * 60 * 1000)))
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes()), SignatureAlgorithm.HS256)
                .compact();
    }
}
