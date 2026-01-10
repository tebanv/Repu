package co.repu.model.users.gateways;

import co.repu.model.users.User;
import reactor.core.publisher.Mono;

public interface UsersRepository {
    Mono<User> findByEmail(String email);
    Mono<User> save(User user);
}
