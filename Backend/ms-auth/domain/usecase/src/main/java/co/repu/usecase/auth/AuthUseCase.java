package co.repu.usecase.auth;

import co.repu.model.system.SystemParameter;
import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.PasswordValidator;
import co.repu.model.users.AuthSession;
import co.repu.model.users.Session;
import co.repu.model.users.User;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.model.users.gateways.UsersRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@RequiredArgsConstructor
public class AuthUseCase {

    private static final java.util.logging.Logger log =
            java.util.logging.Logger.getLogger(AuthUseCase.class.getName());
    private final UsersRepository usersRepository;
    private final SecurityGateway securityGateway;
    private final UserSessionRepository userSessionRepository;
    private final SystemParameterRepository systemParameterRepository;
    private final SessionSecurityGateway sessionSecurityGateway;

    public Mono<String> login(String email, String password, String messageId) {
        return loginSession(email, password, messageId, null, null, null)
                .map(AuthSession::getRawToken);
    }

    public Mono<AuthSession> loginSession(String email, String password, String messageId,
                                          String ipAddress, String userAgent, String deviceInfo) {
        log.info("Iniciando autenticación para correo " + email + ". Solicitud " + messageId);
        return usersRepository.findByEmail(email)
                .switchIfEmpty(Mono.error(new RuntimeException("Credenciales inválidas")))
                .flatMap(user -> {
                    if (Boolean.FALSE.equals(user.getStatus())) {
                        return Mono.error(new RuntimeException("Usuario inactivo"));
                    }
                    if (securityGateway.validatePassword(password, user.getPassword())) {
                        String token = generateOpaqueToken();
                        long expirationSeconds = expirationForRole(user.getRole());
                        LocalDateTime now = LocalDateTime.now();
                        Session session = Session.builder()
                                .userId(user.getId())
                                .tokenHash(hashToken(token))
                                .activeCompanyId(null)
                                .ipAddress(ipAddress)
                                .userAgent(userAgent)
                                .deviceInfo(deviceInfo)
                                .active(true)
                                .expiresAt(now.plusSeconds(expirationSeconds))
                                .createdAt(now)
                                .lastAccess(now)
                                .build();
                        return userSessionRepository.save(session)
                                .flatMap(saved -> sessionSecurityGateway.cache(saved)
                                        .doOnSuccess(ignored -> log.info("Sesión " + saved.getSessionId()
                                                + " creada para usuario " + user.getId()
                                                + " con expiración de " + expirationSeconds + " segundos"))
                                        .thenReturn(AuthSession.builder()
                                                .user(user)
                                                .session(saved)
                                                .rawToken(token)
                                                .expiresInSeconds(expirationSeconds)
                                                .build()));
                    }
                    return Mono.error(new RuntimeException("Credenciales inválidas"));
                });
    }

    public Mono<User> register(User user, String messageId) {
        if (user == null || user.getEmail() == null || user.getPassword() == null) {
            return Mono.error(new RuntimeException("Email y password son obligatorios"));
        }

        if (!PasswordValidator.isValid(user.getPassword())) {
            return Mono.error(new RuntimeException("La contraseña no cumple con los requisitos de seguridad (Min 8 chars, 1 Mayus, 1 Num, 1 Especial)"));
        }

        return usersRepository.findByEmail(user.getEmail())
                .flatMap(existing -> Mono.<User>error(new RuntimeException("El correo ya está registrado")))
                .switchIfEmpty(Mono.defer(() -> {
                    String hashedPassword = securityGateway.hashPassword(user.getPassword());
                    User newUser = user.toBuilder()
                            .password(hashedPassword)
                            .status(true)
                            .role(user.getRole() != null ? user.getRole() : "COMPRADOR")
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .isNew(true)
                            .build();
                    return usersRepository.save(newUser);
                }));
    }

    public Mono<User> getProfile(UUID userId) {
        return usersRepository.findById(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado")));
    }

    public Mono<User> updateProfile(UUID userId, User userPatch) {
        return usersRepository.findById(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado")))
                .flatMap(existing -> {
                    User updated = existing.toBuilder()
                            .name(userPatch.getName() != null ? userPatch.getName() : existing.getName())
                            .lastName(userPatch.getLastName() != null ? userPatch.getLastName() : existing.getLastName())
                            .numberMobile(userPatch.getNumberMobile() != null ? userPatch.getNumberMobile() : existing.getNumberMobile())
                            .attributesUser(userPatch.getAttributesUser() != null ? userPatch.getAttributesUser() : existing.getAttributesUser())
                            .updatedAt(LocalDateTime.now())
                            .build();
                    return usersRepository.save(updated);
                });
    }

    public Mono<User> authenticateSession(String rawToken) {
        return authenticateSessionDetails(rawToken).map(AuthSession::getUser);
    }

    public Mono<AuthSession> authenticateSessionDetails(String rawToken) {
        return sessionSecurityGateway.authenticate(rawToken)
                .flatMap(session -> usersRepository.findById(session.getUserId())
                        .filter(user -> Boolean.TRUE.equals(user.getStatus()))
                        .map(user -> AuthSession.builder()
                                .user(user)
                                .session(session)
                                .build()))
                .switchIfEmpty(Mono.error(new RuntimeException("La sesión no es válida o el usuario está inactivo")));
    }

    public Mono<Void> logout(UUID userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            log.info("Cerrando todas las sesiones del usuario " + userId + " por solicitud de logout");
            return userSessionRepository.findActiveByUserId(userId)
                    .flatMap(sessionSecurityGateway::evict)
                    .then(userSessionRepository.deactivateAllByUserId(userId));
        }
        String sessionTokenHash = hashToken(rawToken);
        return userSessionRepository.findActiveByUserId(userId)
                .filter(session -> session.getTokenHash() != null && session.getTokenHash().equals(sessionTokenHash))
                .next()
                .flatMap(session -> userSessionRepository.deactivateBySessionId(session.getSessionId())
                        .then(sessionSecurityGateway.evict(session)))
                .then();
    }

    public Mono<Void> logoutAll(UUID userId) {
        log.info("Revocando todas las sesiones activas del usuario " + userId);
        return userSessionRepository.findActiveByUserId(userId)
                .flatMap(sessionSecurityGateway::evict)
                .then(userSessionRepository.deactivateAllByUserId(userId));
    }

    public Mono<List<Session>> getSessions(UUID userId) {
        return userSessionRepository.findActiveByUserId(userId)
                .collectList();
    }

    public Flux<SystemParameter> getSystemParameters() {
        return systemParameterRepository.findAllActive();
    }

    public Mono<SystemParameter> getSystemParameterByKey(String key) {
        return systemParameterRepository.findByKey(key)
                .switchIfEmpty(Mono.error(new RuntimeException("Parámetro del sistema no encontrado")));
    }

    public Mono<SystemParameter> saveSystemParameter(SystemParameter systemParameter) {
        if (systemParameter.getKey() == null || systemParameter.getKey().isBlank()) {
            return Mono.error(new RuntimeException("La clave del parámetro es obligatoria"));
        }

        SystemParameter toSave = systemParameter.toBuilder()
                .active(systemParameter.getActive() != null ? systemParameter.getActive() : true)
                .updatedAt(LocalDateTime.now())
                .build();
        return systemParameterRepository.save(toSave);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return token;
        }
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[64];
        new java.security.SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private long expirationForRole(String role) {
        return "ADMIN".equals(role) || "ANALISTA".equals(role)
                ? 8 * 60 * 60L
                : 7 * 24 * 60 * 60L;
    }
}
