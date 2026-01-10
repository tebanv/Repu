package co.com.repu.model.user.gateways;

import co.com.repu.model.user.User;
import reactor.core.publisher.Mono;

public interface UserRepository {
    Mono<User> findByEmail(String email);
    Mono<User> findById(String id); // <--- Necesario para el perfil
    Mono<User> save(User user);
}
