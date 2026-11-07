package co.repu.api;

import co.repu.api.dto.AuthSessionResponse;
import co.repu.api.dto.CurrentSessionResponse;
import co.repu.api.dto.ErrorResponse;
import co.repu.api.dto.LoginRequest;
import co.repu.api.dto.MfaChallengeResponse;
import co.repu.api.dto.MfaVerifyRequest;
import co.repu.api.dto.RegisterRequest;
import co.repu.api.dto.SystemParamInput;
import co.repu.api.dto.SystemParamResponse;
import co.repu.api.dto.UserResponse;
import co.repu.api.dto.UserSession;
import co.repu.api.config.SessionCookieSettings;
import co.repu.model.system.SystemParameter;
import co.repu.model.users.AuthSession;
import co.repu.model.users.InvalidCredentialsException;
import co.repu.model.users.LoginRateLimitExceededException;
import co.repu.model.users.MfaVerificationException;
import co.repu.model.users.Session;
import co.repu.model.users.User;
import co.repu.usecase.auth.AuthUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@Log4j2
public class Handler {

    private static final String HEADER_REQUEST_ID = "X-Request-ID";
    private static final long MFA_CODE_TTL_SECONDS = 300;
    private static final Pattern IPV4_PATTERN = Pattern.compile("\\d{1,3}(\\.\\d{1,3}){3}");
    private final AuthUseCase authUseCase;
    private final SessionCookieSettings sessionCookieSettings;
    @Value("${security.mfa.code-ttl-seconds:300}")
    private long mfaCodeTtlSeconds = MFA_CODE_TTL_SECONDS;
    @Value("${security.login.trust-proxy-headers:false}")
    private boolean trustProxyHeaders;

    public Handler(AuthUseCase authUseCase, SessionCookieSettings sessionCookieSettings) {
        this.authUseCase = authUseCase;
        this.sessionCookieSettings = sessionCookieSettings;
    }

    public Mono<ServerResponse> listenLoginUseCase(ServerRequest serverRequest) {
        if (authUseCase == null) {
            return noAuthUseCase();
        }
        String messageId = getRequestId(serverRequest);

        return serverRequest.bodyToMono(LoginRequest.class)
                .flatMap(request -> authUseCase.loginSession(
                        request.getEmail(),
                        request.getPassword(),
                        messageId,
                        clientIp(serverRequest),
                        serverRequest.headers().firstHeader("User-Agent"),
                        serverRequest.headers().firstHeader("X-Device-Info")))
                .flatMap(result -> result.isMfaRequired()
                        ? ServerResponse.accepted()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(MfaChallengeResponse.builder()
                                        .mfaRequired(true)
                                        .challengeId(result.getChallengeId())
                                        .expiresInSeconds(mfaCodeTtlSeconds)
                                        .build())
                        : completeLoginResponse(result.getAuthSession()))
                .onErrorResume(this::mapAuthenticationError);
    }

    public Mono<ServerResponse> listenVerifyMfaUseCase(ServerRequest serverRequest) {
        return serverRequest.bodyToMono(MfaVerifyRequest.class)
                .flatMap(request -> authUseCase.verifyMfaAndLogin(
                        request.getChallengeId(),
                        request.getCode(),
                        clientIp(serverRequest),
                        serverRequest.headers().firstHeader("User-Agent"),
                        serverRequest.headers().firstHeader("X-Device-Info")))
                .flatMap(this::completeLoginResponse)
                .onErrorResume(this::mapAuthenticationError);
    }

    public Mono<ServerResponse> listenRegisterUseCase(ServerRequest serverRequest) {
        String messageId = getRequestId(serverRequest);

        return serverRequest.bodyToMono(RegisterRequest.class)
                .flatMap(request -> {
                    if (request.getEmail() == null || request.getPassword() == null) {
                        return ServerResponse.badRequest()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(new ErrorResponse("Email y password son obligatorios"));
                    }

                    User userDomain = User.builder()
                            .name(request.getFirstName())
                            .lastName(request.getLastName())
                            .email(request.getEmail())
                            .password(request.getPassword())
                            .numberMobile(request.getPhone())
                            .role(request.getRole())
                            .attributesUser(request.getProfileAttributes())
                            .build();

                    return authUseCase.register(userDomain, messageId)
                            .flatMap(createdUser -> ServerResponse.status(HttpStatus.CREATED)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .bodyValue(mapToUserResponse(createdUser)));
                })
                .onErrorResume(e -> {
                    log.error("Error registrando usuario: {}, messageId: {}", e.getMessage(), messageId);
                    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
                    if (e.getMessage().contains("registrado")
                            || e.getMessage().contains("requisitos de seguridad")
                            || e.getMessage().contains("obligatorios")
                            || e.getMessage().contains("Rol no permitido")) {
                        status = HttpStatus.BAD_REQUEST;
                    }
                    return ServerResponse.status(status).bodyValue(new ErrorResponse(e.getMessage()));
                });
    }

    public Mono<ServerResponse> listenLogoutUseCase(ServerRequest serverRequest) {
        return authUseCase.logoutByToken(extractSessionToken(serverRequest))
                .then(ServerResponse.noContent()
                        .header("Set-Cookie", expiredSessionCookie().toString())
                        .build())
                .onErrorResume(error -> {
                    log.error("No se pudo revocar la sesión durante logout", error);
                    return ServerResponse.status(HttpStatus.SERVICE_UNAVAILABLE)
                            .header("Set-Cookie", expiredSessionCookie().toString())
                            .bodyValue(new ErrorResponse("No fue posible revocar la sesión."));
                });
    }

    public Mono<ServerResponse> listenLogoutAllUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(authUseCase::logoutAll)
                .then(ServerResponse.noContent()
                        .header("Set-Cookie", expiredSessionCookie().toString())
                        .build())
                .onErrorResume(e -> ServerResponse.status(HttpStatus.UNAUTHORIZED)
                        .bodyValue(new ErrorResponse(e.getMessage())));
    }

    public Mono<ServerResponse> listenSessionsUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(userId -> authUseCase.getSessions(userId)
                        .flatMap(sessions -> ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(sessions.stream().map(this::mapToUserSession).toList()))
                )
                .onErrorResume(e -> ServerResponse.status(HttpStatus.UNAUTHORIZED)
                        .bodyValue(new ErrorResponse(e.getMessage())));
    }

    public Mono<ServerResponse> listenCurrentSessionUseCase(ServerRequest serverRequest) {
        return serverRequest.principal()
                .ofType(Authentication.class)
                .map(authentication -> {
                    UUID userId = UUID.fromString(authentication.getName());
                    String role = authentication.getAuthorities().stream()
                            .map(authority -> authority.getAuthority())
                            .filter(authority -> authority.startsWith("ROLE_"))
                            .map(authority -> authority.substring("ROLE_".length()))
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException("La sesión no contiene un rol."));
                    return new CurrentSessionResponse(userId, role);
                })
                .flatMap(principal -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(principal))
                .switchIfEmpty(ServerResponse.status(HttpStatus.UNAUTHORIZED)
                        .bodyValue(new ErrorResponse("Sesión inválida o expirada")));
    }

    public Mono<ServerResponse> listenGetSystemParametersUseCase(ServerRequest serverRequest) {
        return authUseCase.getSystemParameters()
                .collectList()
                .flatMap(params -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(params.stream().map(this::mapToSystemParamResponse).toList()));
    }

    public Mono<ServerResponse> listenCreateSystemParameterUseCase(ServerRequest serverRequest) {
        return serverRequest.bodyToMono(SystemParamInput.class)
                .flatMap(request -> authUseCase.saveSystemParameter(SystemParameter.builder()
                        .key(request.getKey())
                        .configValue(request.getConfigValue())
                        .description(request.getDescription())
                        .active(true)
                        .build()))
                .map(this::mapToSystemParamResponse)
                .flatMap(response -> ServerResponse.status(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(response));
    }

    public Mono<ServerResponse> listenGetSystemParameterByKeyUseCase(ServerRequest serverRequest) {
        String key = serverRequest.pathVariable("key");
        return authUseCase.getSystemParameterByKey(key)
                .map(this::mapToSystemParamResponse)
                .flatMap(response -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(response))
                .onErrorResume(e -> ServerResponse.status(HttpStatus.NOT_FOUND)
                        .bodyValue(new ErrorResponse(e.getMessage())));
    }

    private UserResponse mapToUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private UserSession mapToUserSession(Session session) {
        return UserSession.builder()
                .sessionId(session.getSessionId())
                .deviceInfo(session.getDeviceInfo())
                .ipAddress(session.getIpAddress())
                .lastAccess(session.getLastAccess())
                .expiresAt(session.getExpiresAt())
                .build();
    }

    private SystemParamResponse mapToSystemParamResponse(SystemParameter parameter) {
        return SystemParamResponse.builder()
                .id(parameter.getId())
                .key(parameter.getKey())
                .configValue(parameter.getConfigValue())
                .description(parameter.getDescription())
                .active(parameter.getActive())
                .updatedAt(parameter.getUpdatedAt())
                .build();
    }

    private Mono<ServerResponse> noAuthUseCase() {
        return ServerResponse.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse("AuthUseCase not configured"));
    }

    private Mono<UUID> resolveUserId(ServerRequest request) {
        return request.principal()
                .ofType(Authentication.class)
                .filter(authentication -> authentication.isAuthenticated()
                        && !(authentication instanceof AnonymousAuthenticationToken))
                .map(authentication -> UUID.fromString(authentication.getName()))
                .switchIfEmpty(Mono.error(
                        new IllegalArgumentException("Falta el usuario autenticado en la solicitud")));
    }

    private String extractSessionToken(ServerRequest request) {
        String authorization = request.headers().firstHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        var cookie = request.cookies().getFirst(sessionCookieSettings.name());
        return cookie == null ? null : cookie.getValue();
    }

    private ResponseCookie sessionCookie(String token, long maxAge) {
        return ResponseCookie.from(sessionCookieSettings.name(), token)
                .httpOnly(true)
                .secure(sessionCookieSettings.secure())
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie expiredSessionCookie() {
        return sessionCookie("", 0);
    }

    private Mono<ServerResponse> completeLoginResponse(AuthSession authSession) {
        return ServerResponse.ok()
                .header("Set-Cookie", sessionCookie(authSession.getRawToken(),
                        authSession.getExpiresInSeconds()).toString())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(AuthSessionResponse.builder()
                        .authenticated(true)
                        .userId(authSession.getUser().getId())
                        .role(authSession.getUser().getRole())
                        .accessToken(authSession.getRawToken())
                        .expiresInSeconds(authSession.getExpiresInSeconds())
                        .build());
    }

    private Mono<ServerResponse> mapAuthenticationError(Throwable error) {
        if (error instanceof LoginRateLimitExceededException rateLimit) {
            return ServerResponse.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", Long.toString(rateLimit.getRetryAfterSeconds()))
                    .bodyValue(new ErrorResponse("Demasiados intentos. Inténtalo más tarde."));
        }
        if (error instanceof InvalidCredentialsException) {
            return ServerResponse.status(HttpStatus.UNAUTHORIZED)
                    .bodyValue(new ErrorResponse("Credenciales inválidas"));
        }
        if (error instanceof MfaVerificationException mfaError) {
            HttpStatus status = mfaError.isAttemptsExhausted()
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.UNAUTHORIZED;
            return ServerResponse.status(status)
                    .bodyValue(new ErrorResponse("Código inválido o expirado"));
        }
        log.error("Error interno durante la autenticación", error);
        return ServerResponse.status(HttpStatus.SERVICE_UNAVAILABLE)
                .bodyValue(new ErrorResponse("No fue posible completar la autenticación."));
    }

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID)
                .stream()
                .findFirst()
                .orElse("local-request-id");
    }

    private String clientIp(ServerRequest request) {
        if (trustProxyHeaders) {
            String forwardedFor = request.headers().firstHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                String[] forwardedAddresses = forwardedFor.split(",");
                String candidate = forwardedAddresses[forwardedAddresses.length - 1].strip();
                if (isValidIpLiteral(candidate)) {
                    return candidate;
                }
            }
        }
        return request.remoteAddress()
                .map(address -> address.getAddress() == null
                        ? null : address.getAddress().getHostAddress())
                .orElse(null);
    }

    private boolean isValidIpLiteral(String value) {
        if (IPV4_PATTERN.matcher(value).matches()) {
            for (String octet : value.split("\\.")) {
                try {
                    if (Integer.parseInt(octet) > 255) {
                        return false;
                    }
                } catch (NumberFormatException exception) {
                    return false;
                }
            }
            return true;
        }
        return value.contains(":") && value.matches("[0-9a-fA-F:.]+");
    }
}
