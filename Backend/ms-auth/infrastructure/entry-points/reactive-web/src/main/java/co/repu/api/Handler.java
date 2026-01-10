package co.repu.api;

import co.repu.api.dto.*;
import co.repu.model.users.User;
import co.repu.usecase.auth.AuthUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
@Log4j2
public class Handler {

    private static final String HEADER_REQUEST_ID = "X-Request-ID";

    private final AuthUseCase authUseCase;

    public Mono<ServerResponse> listenLoginUseCase(ServerRequest serverRequest) {

        String messageId = getRequestId(serverRequest);

        return serverRequest.bodyToMono(LoginRequest.class)
                .flatMap(request -> authUseCase.login(request.getEmail(), request.getPassword(), messageId))
                .flatMap(token -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(LoginResponse.builder()
                                .token(token)
                                .type("Bearer")
                                .build()))
                // D. Manejo de errores (Usuario no encontrado, password mal, inactivo)
                .onErrorResume(e -> ServerResponse
                        .status(HttpStatus.UNAUTHORIZED) // O BAD_REQUEST según prefieras
                        .bodyValue(new ErrorResponse(e.getMessage()))
                );
    }

    public Mono<ServerResponse> listenRegisterUseCase(ServerRequest serverRequest) {

        String messageId = getRequestId(serverRequest);

        return serverRequest.bodyToMono(RegisterRequest.class)
                .flatMap(request -> {
                    // Validaciones básicas antes de llamar al dominio
                    if (request.getEmail() == null || request.getPassword() == null) {
                        return ServerResponse.badRequest().bodyValue(new ErrorResponse("Email y password son obligatorios"));
                    }

                    // Mapear DTO a Dominio
                    User userDomain = User.builder()
                            .name(request.getName())
                            .lastName(request.getLastName())
                            .email(request.getEmail())
                            .password(request.getPassword())
                            .numberMobile(request.getNumberMobile())
                            .role(request.getRole()) // Cuidado: validar roles permitidos si es necesario
                            .attributesUser(request.getAttributesUser()) // JSON
                            .build();

                    return authUseCase.register(userDomain, messageId);
                })
                .flatMap(createdUser -> ServerResponse
                        .status(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(mapToUserResponse((User) createdUser))) // Usar mapper de respuesta
                .onErrorResume(e -> {
                    log.error("Error registrando usuario: {}, messageId: {}",e.getMessage(),  messageId);
                    // Diferenciar error de negocio vs error de sistema
                    // Manejo de códigos HTTP según el error
                    HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
                    if (e.getMessage().contains("ya se encuentra registrado") ||
                            e.getMessage().contains("requisitos de seguridad")) {
                        status = HttpStatus.BAD_REQUEST;
                    }

                    return ServerResponse.status(status)
                            .bodyValue(new ErrorResponse(e.getMessage()));
                });
    }

    // Helper para no ensuciar la respuesta con el password
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

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID)
                .stream()
                .findFirst()
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Missing required header: " + HEADER_REQUEST_ID
                ));
    }
}
