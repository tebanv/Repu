package co.repu.api;

import co.repu.api.dto.AuthSessionResponse;
import co.repu.api.dto.ErrorResponse;
import co.repu.api.dto.LoginRequest;
import co.repu.api.dto.LoginResponse;
import co.repu.api.dto.RegisterRequest;
import co.repu.api.dto.SystemParamInput;
import co.repu.api.dto.SystemParamResponse;
import co.repu.api.dto.UserProfile;
import co.repu.api.dto.UserProfileUpdate;
import co.repu.api.dto.UserResponse;
import co.repu.api.dto.UserSession;
import co.repu.model.system.SystemParameter;
import co.repu.model.users.AuthSession;
import co.repu.model.users.Session;
import co.repu.model.users.User;
import co.repu.usecase.auth.AuthUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Component
@Log4j2
public class Handler {

    private static final String HEADER_REQUEST_ID = "X-Request-ID";
    private static final String HEADER_USER_ID = "X-User-Id";
    public static final String SESSION_COOKIE = "__Host-repu_session";

    private final AuthUseCase authUseCase;

    public Handler(AuthUseCase authUseCase) {
        this.authUseCase = authUseCase;
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
                        serverRequest.remoteAddress().map(address -> address.getAddress().getHostAddress()).orElse(null),
                        serverRequest.headers().firstHeader("User-Agent"),
                        serverRequest.headers().firstHeader("X-Device-Info")))
                .flatMap(authSession -> ServerResponse.ok()
                        .header("Set-Cookie", sessionCookie(authSession.getRawToken(),
                                authSession.getExpiresInSeconds()).toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(AuthSessionResponse.builder()
                                .authenticated(true)
                                .userId(authSession.getUser().getId())
                                .role(authSession.getUser().getRole())
                                .accessToken(authSession.getRawToken())
                                .expiresInSeconds(authSession.getExpiresInSeconds())
                                .build()))
                .onErrorResume(e -> ServerResponse.status(HttpStatus.UNAUTHORIZED)
                        .bodyValue(new ErrorResponse(e.getMessage())));
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
                    if (e.getMessage().contains("registrado") || e.getMessage().contains("requisitos de seguridad") || e.getMessage().contains("obligatorios")) {
                        status = HttpStatus.BAD_REQUEST;
                    }
                    return ServerResponse.status(status).bodyValue(new ErrorResponse(e.getMessage()));
                });
    }

    public Mono<ServerResponse> listenLogoutUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(userId -> authUseCase.logout(userId, extractSessionToken(serverRequest)))
                .then(ServerResponse.noContent()
                        .header("Set-Cookie", expiredSessionCookie().toString())
                        .build())
                .onErrorResume(e -> ServerResponse.status(HttpStatus.UNAUTHORIZED)
                        .bodyValue(new ErrorResponse(e.getMessage())));
    }

    public Mono<ServerResponse> listenLogoutAllUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(authUseCase::logoutAll)
                .then(ServerResponse.noContent().build())
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

    public Mono<ServerResponse> listenGetProfileUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(userId -> authUseCase.getProfile(userId)
                        .map(this::mapToProfileResponse)
                        .flatMap(profile -> ServerResponse.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(profile)))
                .onErrorResume(e -> ServerResponse.status(HttpStatus.NOT_FOUND)
                        .bodyValue(new ErrorResponse(e.getMessage())));
    }

    public Mono<ServerResponse> listenUpdateProfileUseCase(ServerRequest serverRequest) {
        return resolveUserId(serverRequest)
                .flatMap(userId -> serverRequest.bodyToMono(UserProfileUpdate.class)
                        .flatMap(request -> {
                            User userPatch = User.builder()
                                    .name(request.getFirstName())
                                    .lastName(request.getLastName())
                                    .numberMobile(request.getPhone())
                                    .attributesUser(request.getProfileAttributes())
                                    .build();
                            return authUseCase.updateProfile(userId, userPatch)
                                    .map(this::mapToProfileResponse)
                                    .flatMap(profile -> ServerResponse.ok()
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .bodyValue(profile));
                        }))
                .onErrorResume(e -> ServerResponse.status(HttpStatus.BAD_REQUEST)
                        .bodyValue(new ErrorResponse(e.getMessage())));
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

    private UserProfile mapToProfileResponse(User user) {
        return UserProfile.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .firstName(user.getName())
                .lastName(user.getLastName())
                .phone(user.getNumberMobile())
                .profileAttributes(user.getProfileAttributes())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
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
                .map(principal -> UUID.fromString(principal.getName()))
                .switchIfEmpty(Mono.defer(() -> {
                    String userId = request.headers().firstHeader(HEADER_USER_ID);
                    if (userId == null || userId.isBlank()) {
                        userId = request.queryParam("userId").orElse("");
                    }
                    if (userId == null || userId.isBlank()) {
                        return Mono.error(new IllegalArgumentException("Falta el usuario autenticado en la solicitud"));
                    }
                    return Mono.just(UUID.fromString(userId));
                }));
    }

    private String extractSessionToken(ServerRequest request) {
        String authorization = request.headers().firstHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        var cookie = request.cookies().getFirst(SESSION_COOKIE);
        return cookie == null ? null : cookie.getValue();
    }

    private ResponseCookie sessionCookie(String token, long maxAge) {
        return ResponseCookie.from(SESSION_COOKIE, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie expiredSessionCookie() {
        return sessionCookie("", 0);
    }

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID)
                .stream()
                .findFirst()
                .orElse("local-request-id");
    }
}
