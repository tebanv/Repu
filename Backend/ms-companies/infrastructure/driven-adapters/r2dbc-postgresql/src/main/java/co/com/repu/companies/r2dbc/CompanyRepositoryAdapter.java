package co.com.repu.companies.r2dbc;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import co.com.repu.companies.r2dbc.mapper.CompanyMapper;
import co.com.repu.companies.r2dbc.repository.CompanyReactiveRepository;
import com.github.f4b6a3.uuid.UuidCreator;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Log4j2
@Repository
@RequiredArgsConstructor
public class CompanyRepositoryAdapter implements CompanyRepository {

    private final CompanyReactiveRepository repository;
    private final CompanyMapper mapper;

    @Override
    public Mono<Company> save(Company company, String messageId) {

        // Lógica: Si no trae ID es creación
        CompanyEntity entity = mapper.toEntity(company);

        if (entity.getId() == null) {
            log.info("Se pasa a guardar una empresa: {}, messageId: {}", company, messageId);
            entity.setId(UuidCreator.getTimeOrderedEpoch());
            entity.setCreatedAt(LocalDateTime.now());
            entity.setNew(true); // Persistable logic
        } else {
            log.info("Se pasa a actualizar una empresa: {}, messageId: {}", company, messageId);
            entity.setNew(false);
        }
        entity.setUpdatedAt(LocalDateTime.now());

        return repository.save(entity)
                .map(mapper::toDomain);
    }

    @Override
    public Flux<Company> findNearest(double lat, double lng, int radiusKm, String messageId) {

        log.info("Se recibe peticion para listar empresas con lat: {}, lng: {}, radio: {} y messageId: {}",
                lat, lng, radiusKm, messageId);

        return repository.findNearest(lat, lng, (double) radiusKm)
                .map(mapper::toDomain);
        // Nota: La columna calculada "distancia" se pierde aquí al pasar al dominio
        // porque Company no tiene ese campo. Si lo necesitas en el front,
        // avísame para agregarlo al modelo Company como @Transient.
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
    public Mono<Company> update(Company company, String messageId) {
        log.info("Se recibe peticion para actualizar Empresa Id: {} y messageId: {}",
                company.getId(), messageId);

        // Actualizamos campos clave (puedes usar un merge manual aquí si prefieres)
        CompanyEntity newEntity = mapper.toEntity(company);
        // Aseguramos que no se pierdan datos de auditoría de creación
        newEntity.setCreatedAt(company.getCreatedAt());
        newEntity.setUpdatedAt(LocalDateTime.now());

        return repository.save(newEntity)
                .map(mapper::toDomain);
    }
}