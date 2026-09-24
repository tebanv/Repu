package co.com.repu.api;

import co.com.repu.model.user.User;
import co.com.repu.model.user.UserAddress;
import co.com.repu.usecase.manageuser.ManageUserUseCase;
import co.com.repu.usecase.manageuser.PasswordRecoveryUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.security.Principal;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class Handler {
    private final ManageUserUseCase manageUserUseCase;
    private final PasswordRecoveryUseCase passwordRecoveryUseCase;
    private static final String HEADER_REQUEST_ID = "X-Request-ID";

    /**
     * GET /users/profile
     * Obtiene el perfil del usuario logueado (desde el Token).
     */
    public Mono<ServerResponse> getMyProfile(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.principal() // <-- Magia de Spring Security
                .map(Principal::getName) // getName() devuelve el ID del usuario (Subject del JWT)
                .flatMap(this::parseUuid)
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
                .flatMap(this::parseUuid)
                .flatMap(userId ->
                        request.bodyToMono(UserUpdateDTO.class)
                                .flatMap(dto -> {
                                    log.info("Solicitud de actualización de perfil para: {}, messageId: {}",
                                            userId, requestId);

                                    // Mapeo DTO -> Dominio (Solo campos permitidos)
                                    User updates = User.builder()
                                            .name(dto.firstName())
                                            .lastName(dto.lastName())
                                            .numberMobile(dto.phone())
                                            .attributesUser(dto.profileAttributes())
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

    public Mono<ServerResponse> getAddresses(ServerRequest request) {
        return authenticatedUserId(request)
                .flatMapMany(manageUserUseCase::getAddresses)
                .collectList()
                .flatMap(addresses -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(addresses.stream().map(this::toAddressResponse).toList()))
                .onErrorResume(e -> handleError(e, getRequestId(request)));
    }

    public Mono<ServerResponse> createAddress(ServerRequest request) {
        return authenticatedUserId(request)
                .flatMap(userId -> request.bodyToMono(UserAddressInput.class)
                        .flatMap(input -> validateAddress(input)
                                .then(manageUserUseCase.createAddress(userId, input.toDomain()))))
                .flatMap(address -> ServerResponse.status(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toAddressResponse(address)))
                .onErrorResume(e -> handleError(e, getRequestId(request)));
    }

    public Mono<ServerResponse> updateAddress(ServerRequest request) {
        return authenticatedUserId(request)
                .flatMap(userId -> parseUuid(request.pathVariable("addressId"))
                        .flatMap(addressId -> request.bodyToMono(UserAddressInput.class)
                                .flatMap(input -> validateAddress(input)
                                        .then(manageUserUseCase.updateAddress(userId, addressId, input.toDomain())))))
                .flatMap(address -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toAddressResponse(address)))
                .onErrorResume(e -> handleError(e, getRequestId(request)));
    }

    public Mono<ServerResponse> deleteAddress(ServerRequest request) {
        return authenticatedUserId(request)
                .flatMap(userId -> parseUuid(request.pathVariable("addressId"))
                        .flatMap(addressId -> manageUserUseCase.deleteAddress(userId, addressId)))
                .then(ServerResponse.noContent().build())
                .onErrorResume(e -> handleError(e, getRequestId(request)));
    }

    public Mono<ServerResponse> requestPasswordRecovery(ServerRequest request) {
        return request.bodyToMono(PasswordRecoveryRequest.class)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("El correo electrónico es obligatorio.")))
                .flatMap(body -> passwordRecoveryUseCase.requestCode(body.email()))
                .then(ServerResponse.accepted()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(new MessageResponse(
                                "Si el correo está registrado, recibirás un código de recuperación.")))
                .onErrorResume(error -> {
                    log.error("Error solicitando recuperación de contraseña: {}", error.getMessage(), error);
                    return ServerResponse.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(new ErrorResponse("No fue posible procesar la solicitud."));
                });
    }

    public Mono<ServerResponse> resetPassword(ServerRequest request) {
        return request.bodyToMono(PasswordResetRequest.class)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Los datos de recuperación son obligatorios.")))
                .flatMap(body -> passwordRecoveryUseCase.resetPassword(
                        body.email(), body.code(), body.newPassword()))
                .then(ServerResponse.noContent().build())
                .onErrorResume(error -> {
                    log.warn("Intento de actualización de contraseña rechazado: {}", error.getMessage());
                    HttpStatus status = error instanceof IllegalArgumentException
                            ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
                    return ServerResponse.status(status)
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(new ErrorResponse(error.getMessage()));
                });
    }

    /**
     * PATCH /users/{userId}/status
     * Admin activa/desactiva usuarios.
     */
    public Mono<ServerResponse> changeUserStatus(ServerRequest request) {
        String requestId = getRequestId(request);
        String targetUserId = request.pathVariable("userId");

        return request.bodyToMono(StatusUpdateDTO.class)
                .flatMap(dto -> {
                    if (dto.active() == null) {
                        return Mono.<User>error(new IllegalArgumentException("El campo 'active' es obligatorio."));
                    }

                    log.info("Solicitud de cambiar estado de usuario {} a: {}, messageId: {}",
                            targetUserId, dto.active(), requestId);
                    return parseUuid(targetUserId)
                            .flatMap(userId -> manageUserUseCase.updateUserStatus(userId, dto.active()));
                })
                .flatMap(user -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(toProfileResponse(user)))
                .onErrorResume(e -> handleError(e, requestId));
    }

    // --- Helpers y DTOs Internos ---

    private Mono<ServerResponse> handleError(Throwable e, String requestId) {
        log.error("Error procesando solicitud: {}, causa: {}, messageId: {}",
                e.getMessage(), rootCauseMessage(e), requestId, e);

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        if (e.getMessage() != null
                && (e.getMessage().contains("no encontrado") || e.getMessage().contains("no encontrada"))) {
            status = HttpStatus.NOT_FOUND;
        }

        if (e instanceof IllegalArgumentException) {
            status = HttpStatus.BAD_REQUEST;
        }

        return ServerResponse.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse(e.getMessage()));
    }

    private String rootCauseMessage(Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getMessage();
    }

    private Mono<UUID> authenticatedUserId(ServerRequest request) {
        return request.principal()
                .map(Principal::getName)
                .flatMap(this::parseUuid)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Sesión requerida.")));
    }

    private Mono<UUID> parseUuid(String value) {
        try {
            return Mono.just(UUID.fromString(value));
        } catch (IllegalArgumentException ex) {
            return Mono.error(new IllegalArgumentException("El ID de usuario o dirección no tiene un formato válido."));
        }
    }

    private Mono<Void> validateAddress(UserAddressInput input) {
        if (input == null || input.name() == null || input.name().isBlank()
                || input.fullAddress() == null || input.fullAddress().isBlank()
                || input.city() == null || input.city().isBlank()
                || input.location() == null || input.location().latitude() == null
                || input.location().longitude() == null
                || input.location().latitude() < -90 || input.location().latitude() > 90
                || input.location().longitude() < -180 || input.location().longitude() > 180) {
            return Mono.error(new IllegalArgumentException("Nombre, dirección, ciudad y coordenadas válidas son obligatorios."));
        }
        return Mono.empty();
    }

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID).stream().findFirst().orElse("UNKNOWN");
    }

    // Mapper de Salida: ¡NUNCA DEVOLVER EL PASSWORD!
    private UserProfileResponse toProfileResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.getName(),
                user.getLastName(),
                user.getNumberMobile(),
                user.getAttributesUser()
        );
    }

    // Records (DTOs) para recibir JSONs limpios
    public record UserUpdateDTO(String firstName, String lastName, String phone, Object profileAttributes) {
    }

    public record StatusUpdateDTO(Boolean active) {
    }

    public record PointCoordinates(Double latitude, Double longitude) {
    }

    public record UserAddressInput(String name, String fullAddress, String city, String postalCode,
                                   Boolean isPrimary, String deliveryNotes, PointCoordinates location) {
        UserAddress toDomain() {
            return UserAddress.builder()
                    .name(name)
                    .fullAddress(fullAddress)
                    .city(city)
                    .postalCode(postalCode)
                    .primary(isPrimary)
                    .latitude(location.latitude())
                    .longitude(location.longitude())
                    .deliveryNotes(deliveryNotes)
                    .build();
        }
    }

    public record UserAddressResponse(UUID id, String name, String fullAddress, String city,
                                      String postalCode, Boolean isPrimary, String deliveryNotes,
                                      PointCoordinates location) {
    }

    private UserAddressResponse toAddressResponse(UserAddress address) {
        return new UserAddressResponse(address.getId(), address.getName(), address.getFullAddress(),
                address.getCity(), address.getPostalCode(), address.getPrimary(),
                address.getDeliveryNotes(),
                new PointCoordinates(address.getLatitude(), address.getLongitude()));
    }

    public record ErrorResponse(String error) {
    }

    public record MessageResponse(String message) {
    }

    public record PasswordRecoveryRequest(String email) {
    }

    public record PasswordResetRequest(String email, String code, String newPassword) {
    }

    public record UserProfileResponse(
            java.util.UUID id,
            String email,
            String role,
            String firstName,
            String lastName,
            String phone,
            Object profileAttributes
    ) {
    }
}
