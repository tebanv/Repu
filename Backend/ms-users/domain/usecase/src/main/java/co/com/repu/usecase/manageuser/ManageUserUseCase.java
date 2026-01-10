package co.com.repu.usecase.manageuser;

import co.com.repu.model.user.User;
import co.com.repu.model.user.gateways.UserRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageUserUseCase {

    private final UserRepository userRepository;

    // 1. Obtener mi perfil
    public Mono<User> getMyProfile(String userId) {
        return userRepository.findByEmail(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado en el sistema.")));
    }

    // 2. Actualizar mi información personal
    public Mono<User> updateMyProfile(String userId, User updates) {
        return userRepository.findByEmail(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado para actualización.")))
                .flatMap(existingUser -> {
                    // Lógica de Mezcla (Patch): Solo sobrescribimos si no es nulo
                    User updatedUser = existingUser.toBuilder()
                            .name(updates.getName() != null ? updates.getName() : existingUser.getName())
                            .lastName(updates.getLastName() != null ? updates.getLastName() : existingUser.getLastName())
                            .numberMobile(updates.getNumberMobile() != null ? updates.getNumberMobile() : existingUser.getNumberMobile())
                            // El email y el rol NO se deberían cambiar por este endpoint por seguridad
                            // attributesUser (JSON) se actualiza completo si viene
                            .attributesUser(updates.getAttributesUser() != null ? updates.getAttributesUser() : existingUser.getAttributesUser())
                            .updatedAt(java.time.LocalDateTime.now())
                            .build();

                    return userRepository.save(updatedUser);
                });
    }

    // 3. Cambiar estado (Admin)
    public Mono<User> updateUserStatus(String userId, Boolean newStatus) {
        return userRepository.findById(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario objetivo no encontrado.")))
                .flatMap(existingUser -> {
                    // Solo actualizamos si el estado es diferente
                    if (existingUser.getStatus().equals(newStatus)) {
                        return Mono.just(existingUser);
                    }

                    User updatedUser = existingUser.toBuilder()
                            .status(newStatus)
                            .updatedAt(java.time.LocalDateTime.now())
                            .build();

                    return userRepository.save(updatedUser);
                });
    }

}
