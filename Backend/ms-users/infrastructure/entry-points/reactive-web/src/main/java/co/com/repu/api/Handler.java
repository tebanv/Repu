package co.com.repu.api;

import co.com.repu.model.user.User;
import co.com.repu.usecase.manageuser.ManageUserUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.util.regex.Pattern;
import java.security.Principal;

@Slf4j
@Component
@RequiredArgsConstructor
public class Handler {
    private final ManageUserUseCase manageUserUseCase;
    private static final String HEADER_REQUEST_ID = "X-Request-ID";
    // Regex UUID v4/v7
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F-]{36}$");

    /**
     * GET /users/profile
     * Obtiene el perfil del usuario logueado (desde el Token).
     */
    public Mono<ServerResponse> getMyProfile(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.principal() // <-- Magia de Spring Security
                .map(Principal::getName) // getName() devuelve el ID del usuario (Subject del JWT)
                .flatMap(userId -> {
                    log.info("Consultando perfil para usuario: {}, messageId: {}", userId, requestId);
                    return manageUserUseCase.getMyProfile(userId);
                })
                .flatMap(user -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toProfileResponse(user)))
                // Si no hay principal (no debería pasar si SecurityConfig está bien), es 401
                .switchIfEmpty(ServerResponse.status(HttpStatus.UNAUTHORIZED).build())
                .onErrorResume(e -> handleError(e, requestId));
    }

    /**
     * PATCH /users/profile
     * Actualiza datos personales del usuario logueado.
     */
    public Mono<ServerResponse> updateMyProfile(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.principal()
                .map(Principal::getName) // ID del usuario autenticado
                .flatMap(userId ->
                        request.bodyToMono(UserUpdateDTO.class)
                                .flatMap(dto -> {
                                    log.info("Solicitud de actualización de perfil para: {}, messageId: {}",
                                            userId, requestId);

                                    // Mapeo DTO -> Dominio (Solo campos permitidos)
                                    User updates = User.builder()
                                            .name(dto.name())
                                            .lastName(dto.lastName())
                                            .numberMobile(dto.numberMobile())
                                            .attributesUser(dto.attributesUser())
                                            .build();

                                    return manageUserUseCase.updateMyProfile(userId, updates);
                                })
                )
                .flatMap(updatedUser -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toProfileResponse(updatedUser)))
                .switchIfEmpty(ServerResponse.status(HttpStatus.UNAUTHORIZED).build())
                .onErrorResume(e -> handleError(e, requestId));
    }

    /**
     * PATCH /users/{userId}/status
     * Admin activa/desactiva usuarios.
     */
    public Mono<ServerResponse> changeUserStatus(ServerRequest request) {
        String requestId = getRequestId(request);
        String targetUserId = request.pathVariable("userId");

        // Validación de UUID en el path
        if (!UUID_PATTERN.matcher(targetUserId).matches()) {
            return ServerResponse.badRequest()
                    .bodyValue(new ErrorResponse("El ID de usuario proporcionado no tiene un formato válido."));
        }

        return request.bodyToMono(StatusUpdateDTO.class)
                .flatMap(dto -> {
                    if (dto.active() == null) {
                        return ServerResponse.badRequest()
                                .bodyValue(new ErrorResponse("El campo 'active' es obligatorio."));
                    }

                    log.info("Solicitud de cambiar estado de usuario {} a: {}, messageId: {}",
                            targetUserId, dto.active(), requestId);
                    return manageUserUseCase.updateUserStatus(targetUserId, dto.active());
                })
                .flatMap(user -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toProfileResponse((User) user)))
                .onErrorResume(e -> handleError(e, requestId));
    }

    // --- Helpers y DTOs Internos ---

    private Mono<ServerResponse> handleError(Throwable e, String requestId) {
        log.error("Error procesando solicitud: {}, messageId: {}", e.getMessage(), requestId);

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        if (e.getMessage().contains("no encontrado")) {
            status = HttpStatus.NOT_FOUND;
        }

        return ServerResponse.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse(e.getMessage()));
    }

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID).stream().findFirst().orElse("UNKNOWN");
    }

    // Mapper de Salida: ¡NUNCA DEVOLVER EL PASSWORD!
    private UserProfileResponse toProfileResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getLastName(),
                user.getEmail(),
                user.getNumberMobile(),
                user.getRole(),
                user.getStatus(),
                user.getAttributesUser(),
                user.getLastLogin(),
                user.getCreatedAt()
        );
    }

    // Records (DTOs) para recibir JSONs limpios
    public record UserUpdateDTO(String name, String lastName, String numberMobile, Object attributesUser) {
    }

    public record StatusUpdateDTO(Boolean active) {
    }

    public record ErrorResponse(String error) {
    }

    public record UserProfileResponse(
            java.util.UUID id,
            String name,
            String lastName,
            String email,
            String numberMobile,
            String role,
            Boolean status,
            Object attributesUser,
            java.time.LocalDateTime lastLogin,
            java.time.LocalDateTime createdAt
    ) {
    }
}
