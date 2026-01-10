package co.com.repu.r2dbc;
import co.com.repu.model.user.User;
import co.com.repu.model.user.gateways.UserRepository;
import co.com.repu.r2dbc.entity.UserEntity;
import co.com.repu.r2dbc.mapper.UserMapper;
import co.com.repu.r2dbc.repository.UserReactiveRepository;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
@RequiredArgsConstructor
@Slf4j
public class UserRepositoryAdapter implements UserRepository {

    private final UserReactiveRepository repository;
    private final UserMapper mapper;

    @Override
    public Mono<User> findByEmail(String email) {
        return repository.findByEmail(email)
                .map(mapper::toDomain)
                .doOnNext(u -> log.debug("Usuario encontrado por email: {}", email));
    }

    @Override
    public Mono<User> findById(String id) {
        // R2DBC espera UUID en el método findById si la PK es UUID en la Entity
        return repository.findById(id)
                .map(mapper::toDomain)
                .doOnNext(u -> log.debug("Usuario encontrado por ID: {}", id));
    }

    @Override
    public Mono<User> save(User user) {
        UserEntity entity = mapper.toEntity(user);

        if (entity.getId() == null) {
            // --- CREACIÓN (INSERT) ---
            log.info("Generando nuevo ID (UUID v7) para usuario nuevo.");
            entity.setId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true); // Fuerza INSERT en R2DBC
        } else {
            // --- ACTUALIZACIÓN (UPDATE) ---
            log.debug("Actualizando usuario existente ID: {}", entity.getId());
            entity.setNew(false); // Fuerza UPDATE en R2DBC

            // Truco: Para no perder la fecha de creación si el dominio no la traía,
            // en un update real a veces se hace una búsqueda previa,
            // pero si confías en que el dominio trae la fecha correcta, esto basta.
            // Si el dominio trae createdAt nulo, podrías sobrescribirlo por error.
            // Lo ideal es que el UseCase preserve el createdAt del objeto original.
        }

        entity.setUpdatedAt(LocalDateTime.now());

        return repository.save(entity)
                .map(mapper::toDomain)
                .doOnError(e -> log.error("Error guardando usuario en BD: {}", e.getMessage()));
    }
}
