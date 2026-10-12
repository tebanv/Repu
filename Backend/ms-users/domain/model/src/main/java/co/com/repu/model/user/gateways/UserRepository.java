package co.com.repu.model.user.gateways;

import co.com.repu.model.user.User;
import reactor.core.publisher.Mono;
import java.util.UUID;

public interface UserRepository {
    Mono<User> findByEmail(String email);
    Mono<User> findById(UUID id);
    Mono<User> save(User user);
}
