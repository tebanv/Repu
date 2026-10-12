package co.com.repu.model.user.gateways;

import co.com.repu.model.user.UserAddress;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface UserAddressRepository {
    Flux<UserAddress> findActiveByUserId(UUID userId);
    Mono<UserAddress> findActiveByIdAndUserId(UUID addressId, UUID userId);
    Mono<UserAddress> save(UserAddress address);
    Mono<Boolean> deactivate(UUID addressId, UUID userId);
}
