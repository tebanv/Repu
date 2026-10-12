package co.com.repu.usecase.manageuser;

import co.com.repu.model.user.User;
import co.com.repu.model.user.UserAddress;
import co.com.repu.model.user.gateways.UserRepository;
import co.com.repu.model.user.gateways.UserAddressRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
public class ManageUserUseCase {

    private final UserRepository userRepository;
    private final UserAddressRepository addressRepository;

    // 1. Obtener mi perfil
    public Mono<User> getMyProfile(UUID userId) {
        return userRepository.findById(userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado en el sistema.")));
    }

    // 2. Actualizar mi información personal
    public Mono<User> updateMyProfile(UUID userId, User updates) {
        return userRepository.findById(userId)
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
    public Mono<User> updateUserStatus(UUID userId, Boolean newStatus) {
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

    public Flux<UserAddress> getAddresses(UUID userId) {
        return addressRepository.findActiveByUserId(userId);
    }

    public Mono<UserAddress> createAddress(UUID userId, UserAddress input) {
        return addressRepository.save(input.toBuilder().userId(userId).active(true).build());
    }

    public Mono<UserAddress> updateAddress(UUID userId, UUID addressId, UserAddress updates) {
        return addressRepository.findActiveByIdAndUserId(addressId, userId)
                .switchIfEmpty(Mono.error(new RuntimeException("Dirección no encontrada.")))
                .flatMap(existing -> addressRepository.save(existing.toBuilder()
                        .name(updates.getName() != null ? updates.getName() : existing.getName())
                        .fullAddress(updates.getFullAddress() != null ? updates.getFullAddress() : existing.getFullAddress())
                        .city(updates.getCity() != null ? updates.getCity() : existing.getCity())
                        .postalCode(updates.getPostalCode() != null ? updates.getPostalCode() : existing.getPostalCode())
                        .primary(updates.getPrimary() != null ? updates.getPrimary() : existing.getPrimary())
                        .latitude(updates.getLatitude() != null ? updates.getLatitude() : existing.getLatitude())
                        .longitude(updates.getLongitude() != null ? updates.getLongitude() : existing.getLongitude())
                        .deliveryNotes(updates.getDeliveryNotes() != null ? updates.getDeliveryNotes() : existing.getDeliveryNotes())
                        .updatedAt(LocalDateTime.now())
                        .build()));
    }

    public Mono<Void> deleteAddress(UUID userId, UUID addressId) {
        return addressRepository.deactivate(addressId, userId)
                .flatMap(deactivated -> deactivated
                        ? Mono.<Void>empty()
                        : Mono.error(new RuntimeException("Dirección no encontrada.")));
    }

}
