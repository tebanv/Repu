package co.com.repu.companies.r2dbc;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import co.com.repu.companies.r2dbc.mapper.CompanyMapper;
import co.com.repu.companies.r2dbc.repository.CompanyReactiveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class CompanyRepositoryAdapter implements CompanyRepository {

    private final CompanyReactiveRepository repository;
    private final CompanyMapper mapper;

    @Override
    public Mono<Company> save(Company company) {
        // Lógica: Si no trae ID es creación
        CompanyEntity entity = mapper.toEntity(company);

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID().toString());
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());

        return repository.save(entity)
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Company> findById(String id) {
        return repository.findById(id)
                .map(mapper::toDomain);
    }

    @Override
    public Flux<Company> findAll() {
        return repository.findAll()
                .map(mapper::toDomain);
    }

    @Override
    public Mono<Company> update(Company company) {
        // Para update, primero buscamos si existe para asegurar consistencia
        return repository.findById(company.getId())
                .flatMap(existingEntity -> {
                    // Actualizamos campos clave (puedes usar un merge manual aquí si prefieres)
                    CompanyEntity newEntity = mapper.toEntity(company);
                    // Aseguramos que no se pierdan datos de auditoría de creación
                    newEntity.setCreatedAt(existingEntity.getCreatedAt());
                    newEntity.setUpdatedAt(LocalDateTime.now());

                    return repository.save(newEntity);
                })
                .map(mapper::toDomain);
    }
}