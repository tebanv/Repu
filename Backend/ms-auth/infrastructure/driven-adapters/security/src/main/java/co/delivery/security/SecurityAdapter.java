package co.delivery.security;
import co.delivery.model.clients.gateways.SecurityGateway;
import co.delivery.model.clients.Client;
import io.jsonwebtoken.io.Decoders;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Log
@Component
public class SecurityAdapter implements SecurityGateway {

    private final PasswordEncoder passwordEncoder;
    private final Key key;

    public SecurityAdapter(PasswordEncoder passwordEncoder,
                           @Value("${security.jwt.secret}") String jwtSecret) {

        this.passwordEncoder = passwordEncoder;
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    @Override
    public boolean validatePassword(String cleanPassword, String hashStoredPassword) {
        log.info(cleanPassword);
        return passwordEncoder.matches(cleanPassword, hashStoredPassword);
    }

    @Override
    public String generateToken(Client clients) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("rol", clients.getRole());
        claims.put("company_id", clients.getCompanyId());
        claims.put("nombre", clients.getName());

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(clients.getEmail())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(key)
                .compact();
    }
}
