package co.repu.model.users.gateways;

import co.repu.model.users.User;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface UsersRepository {
    Mono<User> findByEmail(String email);
    Mono<User> findById(UUID id);
    Mono<User> save(User user);
}
