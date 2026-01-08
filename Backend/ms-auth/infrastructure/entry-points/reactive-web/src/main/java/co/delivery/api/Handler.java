package co.delivery.api;

import co.delivery.api.dto.ErrorResponse;
import co.delivery.api.dto.LoginRequest;
import co.delivery.api.dto.LoginResponse;
import co.delivery.usecase.auth.AuthUseCase;
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
    private final AuthUseCase authUseCase;

    public Mono<ServerResponse> listenLoginUseCase(ServerRequest serverRequest) {

        return serverRequest.bodyToMono(LoginRequest.class)
                .flatMap(request -> authUseCase.login(request.getCompanyId(), request.getEmail(), request.getPassword()))
                .flatMap(token -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(LoginResponse.builder()
                                .token(token)
                                .tipo("Bearer")
                                .build()))
                // D. Manejo de errores (Usuario no encontrado, password mal, inactivo)
                .onErrorResume(e -> ServerResponse
                        .status(HttpStatus.UNAUTHORIZED) // O BAD_REQUEST según prefieras
                        .bodyValue(new ErrorResponse(e.getMessage()))
                );
    }
}
