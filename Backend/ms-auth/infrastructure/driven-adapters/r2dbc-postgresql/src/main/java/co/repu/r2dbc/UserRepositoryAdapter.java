package co.repu.r2dbc;

import co.repu.model.users.User;
import co.repu.model.users.gateways.UsersRepository;
import co.repu.r2dbc.entity.UserEntity;
import co.repu.r2dbc.mapper.UserMapper;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
@RequiredArgsConstructor
@Log4j2
public class UserRepositoryAdapter implements UsersRepository {

    private final UserReactiveRepository userReactiveRepository;
    private final UserMapper mapper;

    @Override
    public Mono<User> findByEmail(String email) {

        return userReactiveRepository.findByEmail(email)
                .map(mapper::toDomain);
    }
    @Override
    public Mono<User> save(User user) {
        UserEntity entity = mapper.toEntity(user);

        if (entity.getId() == null) {
            // Generación UUID v7 (Ordenado por tiempo)
            entity.setId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true); // Forzar INSERT
        } else {
            entity.setNew(false); // UPDATE
        }
        entity.setUpdatedAt(LocalDateTime.now());

        return userReactiveRepository.save(entity)
                .map(mapper::toDomain);
    }


}
