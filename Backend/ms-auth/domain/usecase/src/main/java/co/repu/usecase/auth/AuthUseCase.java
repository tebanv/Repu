package co.repu.usecase.auth;

import co.repu.model.system.SystemParameter;
import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.PasswordValidator;
import co.repu.model.users.AuthSession;
import co.repu.model.users.InvalidCredentialsException;
import co.repu.model.users.LoginResult;
import co.repu.model.users.Session;
import co.repu.model.users.User;
import co.repu.model.users.gateways.EmailMfaGateway;
import co.repu.model.users.gateways.LoginProtectionGateway;
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
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RequiredArgsConstructor
public class AuthUseCase {

    private static final java.util.logging.Logger log =
            java.util.logging.Logger.getLogger(AuthUseCase.class.getName());
    private static final Set<String> SELF_REGISTRATION_ROLES =
            Set.of("COMPRADOR", "DISTRIBUIDOR", "DOMICILIARIO");
    private final UsersRepository usersRepository;
    private final SecurityGateway securityGateway;
    private final UserSessionRepository userSessionRepository;
    private final SystemParameterRepository systemParameterRepository;
    private final SessionSecurityGateway sessionSecurityGateway;
    private final LoginProtectionGateway loginProtectionGateway;
    private final EmailMfaGateway emailMfaGateway;

    public Mono<String> login(String email, String password, String messageId) {
        return loginSession(email, password, messageId, null, null, null)
                .flatMap(result -> result.getAuthSession() == null
                        ? Mono.error(new IllegalStateException("El usuario debe completar MFA"))
                        : Mono.just(result.getAuthSession().getRawToken()));
    }

    public Mono<LoginResult> loginSession(String email, String password, String messageId,
                                          String ipAddress, String userAgent, String deviceInfo) {
        log.info("Iniciando autenticación. Solicitud " + messageId);
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return Mono.error(new InvalidCredentialsException());
        }

        String normalizedEmail = email.strip();
        return loginProtectionGateway.checkIpLimit(ipAddress)
                .then(loginProtectionGateway.checkAccountLock(normalizedEmail))
                .then(usersRepository.findByEmail(normalizedEmail)
                        .filter(user -> Boolean.TRUE.equals(user.getStatus()))
                        .filter(user -> securityGateway.validatePassword(password, user.getPassword()))
                        .switchIfEmpty(Mono.defer(() -> loginProtectionGateway
                                .recordFailedAttempt(normalizedEmail)
                                .then(Mono.error(new InvalidCredentialsException())))))
                .flatMap(user -> loginProtectionGateway.clearFailedAttempts(normalizedEmail)
                        .then(Mono.defer(() -> {
                            if (requiresMfa(user.getRole())) {
                                return emailMfaGateway.createAndSendChallenge(
                                                user.getId(), user.getEmail(), user.getName())
                                        .map(LoginResult::challenge);
                            }
                            return createSession(user, ipAddress, userAgent, deviceInfo)
                                    .map(LoginResult::authenticated);
                        })));
    }

    public Mono<AuthSession> verifyMfaAndLogin(String challengeId, String code,
                                               String ipAddress, String userAgent, String deviceInfo) {
        return emailMfaGateway.verifyChallenge(challengeId, code)
                .flatMap(usersRepository::findById)
                .filter(user -> Boolean.TRUE.equals(user.getStatus()) && requiresMfa(user.getRole()))
                .switchIfEmpty(Mono.error(new InvalidCredentialsException()))
                .flatMap(user -> createSession(user, ipAddress, userAgent, deviceInfo));
    }

    private Mono<AuthSession> createSession(User user, String ipAddress,
                                            String userAgent, String deviceInfo) {
        String token = generateOpaqueToken();
        long idleExpirationSeconds = expirationForRole(user.getRole());
        LocalDateTime now = LocalDateTime.now();
        Session session = Session.builder()
                .userId(user.getId())
                .userRole(user.getRole())
                .absoluteExpiresAt(now.plusSeconds(absoluteExpirationForRole(user.getRole())))
                .tokenHash(hashToken(token))
                .activeCompanyId(null)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .deviceInfo(deviceInfo)
                .active(true)
                .expiresAt(now.plusSeconds(idleExpirationSeconds))
                .createdAt(now)
                .lastAccess(now)
                .build();
        return userSessionRepository.save(session)
                .map(saved -> saved.toBuilder()
                        .userRole(session.getUserRole())
                        .absoluteExpiresAt(session.getAbsoluteExpiresAt())
                        .build())
                .flatMap(saved -> sessionSecurityGateway.cache(saved)
                        .doOnSuccess(ignored -> log.info("Sesión " + saved.getSessionId()
                                + " creada para usuario " + user.getId()))
                        .thenReturn(AuthSession.builder()
                                .user(user)
                                .session(saved)
                                .rawToken(token)
                                .expiresInSeconds(idleExpirationSeconds)
                                .build()));
    }

    public Mono<User> register(User user, String messageId) {
        if (user == null || user.getEmail() == null || user.getPassword() == null) {
            return Mono.error(new RuntimeException("Email y password son obligatorios"));
        }

        String role = user.getRole() == null || user.getRole().isBlank()
                ? "COMPRADOR"
                : user.getRole().strip().toUpperCase(Locale.ROOT);
        if (!SELF_REGISTRATION_ROLES.contains(role)) {
            return Mono.error(new RuntimeException("Rol no permitido para autorregistro"));
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
                            .role(role)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .isNew(true)
                            .build();
                    return usersRepository.save(newUser);
                }));
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
            return Mono.empty();
        }
        String sessionTokenHash = hashToken(rawToken);
        return userSessionRepository.findActiveByUserId(userId)
                .filter(session -> session.getTokenHash() != null && session.getTokenHash().equals(sessionTokenHash))
                .next()
                .flatMap(session -> userSessionRepository.deactivateBySessionId(session.getSessionId())
                        .then(sessionSecurityGateway.evict(session)))
                .then();
    }

    public Mono<Void> logoutByToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Mono.empty();
        }
        return userSessionRepository.findByTokenHash(hashToken(rawToken))
                .filter(session -> Boolean.TRUE.equals(session.getActive()))
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
        return isPrivilegedRole(role)
                ? 8 * 60 * 60L
                : 7 * 24 * 60 * 60L;
    }

    private long absoluteExpirationForRole(String role) {
        return isPrivilegedRole(role)
                ? 24 * 60 * 60L
                : 30 * 24 * 60 * 60L;
    }

    private boolean requiresMfa(String role) {
        return isPrivilegedRole(role);
    }

    private boolean isPrivilegedRole(String role) {
        return role != null && Set.of("ADMIN", "ANALISTA").contains(role.toUpperCase(Locale.ROOT));
    }
}
