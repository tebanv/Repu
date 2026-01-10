package co.repu.usecase.auth;

import co.repu.model.users.PasswordValidator;
import co.repu.model.users.User;
import co.repu.model.users.gateways.UsersRepository;
import co.repu.model.users.gateways.SecurityGateway;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@RequiredArgsConstructor
public class AuthUseCase {

    private final UsersRepository usersRepository;
    private final SecurityGateway securityGateway;

    public Mono<String> login(String email, String password, String messageId) {
        return usersRepository.findByEmail(email)
                .switchIfEmpty(Mono.error(new RuntimeException("Credenciales inválidas")))
                .flatMap(user -> {
                    if (Boolean.FALSE.equals(user.getStatus())) {
                        return Mono.error(new RuntimeException("Usuario inactivo"));
                    }
                    if (securityGateway.validatePassword(password, user.getPassword())) {
                        return Mono.just(securityGateway.generateToken(user));
                    }
                    return Mono.error(new RuntimeException("Credenciales inválidas"));
                });
    }

    // --- REGISTER (NUEVO) ---
    public Mono<User> register(User user, String messageId) {
        // 1. Validaciones de Negocio Puras
        if (!PasswordValidator.isValid(user.getPassword())) {
            return Mono.error(new RuntimeException("La contraseña no cumple con los requisitos de seguridad (Min 8 chars, 1 Mayus, 1 Num, 1 Especial)"));
        }

        // 2. Flujo Reactivo
        return usersRepository.findByEmail(user.getEmail())
                // Si encontramos algo, es un error (Ya existe)
                .flatMap(existing -> Mono.<User>error(new RuntimeException("El correo ya está registrado")))
                // Si está vacío (switchIfEmpty), procedemos a crear
                .switchIfEmpty(Mono.defer(() -> {
                    // 1. Encriptar contraseña
                    String hashedPassword = securityGateway.hashPassword(user.getPassword());

                    // 2. Preparar usuario
                    User newUser = user.toBuilder()
                            .password(hashedPassword)
                            .status(true) // Activo por defecto
                            // Si no viene rol, asignar uno por defecto (ej: BUYER)
                            .role(user.getRole() != null ? user.getRole() : "BUYER")
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .isNew(true) // Flag para el adaptador (Persistable)
                            .build();

                    // 3. Guardar
                    return usersRepository.save(newUser);
                }));
    }

}
