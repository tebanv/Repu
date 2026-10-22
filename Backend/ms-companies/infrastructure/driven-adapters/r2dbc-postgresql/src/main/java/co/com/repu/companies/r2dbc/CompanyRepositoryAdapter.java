package co.com.repu.companies.r2dbc;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import co.com.repu.companies.r2dbc.mapper.CompanyMapper;
import com.github.f4b6a3.uuid.UuidCreator;
import io.r2dbc.postgresql.codec.Json;
import io.r2dbc.spi.Row;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
@Slf4j
public class CompanyRepositoryAdapter implements CompanyRepository {

    private static final String SELECT_COLUMNS = """
            id_empresa, id_usuario_propietario, razon_social, nit_identificacion, logo_url,
            descripcion_tienda, configuracion_operativa, direccion_fisica, telefono_comercial,
            banner_url, slug, public.ST_Y(ubicacion::public.geometry) AS latitud,
            public.ST_X(ubicacion::public.geometry) AS longitud, calificacion_promedio,
            total_resenas, activo, fecha_creacion, fecha_actualizacion
            """;

    private final DatabaseClient databaseClient;
    private final CompanyMapper mapper;

    @Override
    public Mono<Company> save(Company company, String messageId) {
        if (company.getId() == null) {
            UUID id = UuidCreator.getTimeOrderedEpoch();
            company.setId(id.toString());
            company.setSlug(createSlug(company.getName(), id));
            log.info("Creando empresa [{}] con id: {}, messageId: {}",company.getName(),  id, messageId);
            return insert(company, id);
        }

        log.info("Actualizando empresa id: {}, messageId: {}", company.getId(), messageId);
        return updateCompany(company, UUID.fromString(company.getId()));
    }

    @Override
    public Flux<Company> findNearest(double lat, double lng, int radiusKm, String messageId) {
        log.info("Buscando empresas cercanas lat: {}, lng: {}, radioKm: {}, messageId: {}",
                lat, lng, radiusKm, messageId);
        return databaseClient.sql("""
                        SELECT %s,
                               public.ST_Distance(
                                   ubicacion,
                                   CAST(public.ST_SetSRID(public.ST_MakePoint($2, $1), 4326)
                                        AS public.geography)
                               ) AS distancia
                        FROM repu.empresas
                        WHERE public.ST_DWithin(
                            ubicacion,
                            CAST(public.ST_SetSRID(public.ST_MakePoint($2, $1), 4326)
                                 AS public.geography),
                            $3
                        )
                        ORDER BY distancia ASC
                        """.formatted(SELECT_COLUMNS))
                .bind(0, lat)
                .bind(1, lng)
                .bind(2, radiusKm * 1000.0)
                .map((row, metadata) -> mapper.toDomain(toEntity(row)))
                .all();
    }

    @Override
    public Mono<Company> findById(String id) {
        return databaseClient.sql("SELECT " + SELECT_COLUMNS
                        + " FROM repu.empresas WHERE id_empresa = $1")
                .bind(0, UUID.fromString(id))
                .map((row, metadata) -> mapper.toDomain(toEntity(row)))
                .one();
    }

    @Override
    public Flux<Company> findAll() {
        return databaseClient.sql("SELECT " + SELECT_COLUMNS
                        + " FROM repu.empresas ORDER BY fecha_creacion DESC")
                .map((row, metadata) -> mapper.toDomain(toEntity(row)))
                .all();
    }

    @Override
    public Mono<Company> update(Company company, String messageId) {
        return save(company, messageId);
    }

    private Mono<Company> insert(Company company, UUID id) {
        DatabaseClient.GenericExecuteSpec statement = databaseClient.sql("""
                        INSERT INTO repu.empresas
                        (id_empresa, id_usuario_propietario, razon_social, nit_identificacion, logo_url,
                         descripcion_tienda, configuracion_operativa, direccion_fisica, ubicacion,
                         calificacion_promedio, activo, slug, telefono_comercial, banner_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7,
                                $8, CAST(public.ST_SetSRID(public.ST_MakePoint($9, $10), 4326)
                                         AS public.geography),
                                COALESCE($11, 0), COALESCE($12, TRUE), $13, $14, $15)
                        RETURNING %s
                        """.formatted(SELECT_COLUMNS))
                .bind(0, id)
                .bind(1, company.getUserIdOwner())
                .bind(2, company.getName())
                .bind(3, company.getTaxId())
                .bind(6, mapper.toJson(company.getOperationalConfig()))
                .bind(7, company.getAddress())
                .bind(8, company.getLongitude())
                .bind(9, company.getLatitude())
                .bind(12, company.getSlug());
        statement = bindNullable(statement, 4, company.getLogoUrl(), String.class);
        statement = bindNullable(statement, 5, company.getDescription(), String.class);
        statement = bindNullable(statement, 10, company.getRating() == null
                ? null : BigDecimal.valueOf(company.getRating()), BigDecimal.class);
        statement = bindNullable(statement, 11, company.getActive(), Boolean.class);
        statement = bindNullable(statement, 13, company.getPhone(), String.class);
        statement = bindNullable(statement, 14, company.getBannerUrl(), String.class);
        return statement.map((row, metadata) -> mapper.toDomain(toEntity(row))).one();
    }

    private Mono<Company> updateCompany(Company company, UUID id) {
        DatabaseClient.GenericExecuteSpec statement = databaseClient.sql("""
                        UPDATE repu.empresas
                        SET razon_social = $2, nit_identificacion = $3, logo_url = $4,
                            descripcion_tienda = $5, configuracion_operativa = $6,
                            direccion_fisica = $7,
                            ubicacion = CAST(public.ST_SetSRID(public.ST_MakePoint($8, $9), 4326)
                                             AS public.geography),
                            calificacion_promedio = COALESCE($10, calificacion_promedio),
                            activo = COALESCE($11, activo), telefono_comercial = $12,
                            banner_url = $13, fecha_actualizacion = CURRENT_TIMESTAMP
                        WHERE id_empresa = $1
                        RETURNING %s
                        """.formatted(SELECT_COLUMNS))
                .bind(0, id)
                .bind(1, company.getName())
                .bind(2, company.getTaxId())
                .bind(5, mapper.toJson(company.getOperationalConfig()))
                .bind(6, company.getAddress())
                .bind(7, company.getLongitude())
                .bind(8, company.getLatitude());
        statement = bindNullable(statement, 3, company.getLogoUrl(), String.class);
        statement = bindNullable(statement, 4, company.getDescription(), String.class);
        statement = bindNullable(statement, 9, company.getRating() == null
                ? null : BigDecimal.valueOf(company.getRating()), BigDecimal.class);
        statement = bindNullable(statement, 10, company.getActive(), Boolean.class);
        statement = bindNullable(statement, 11, company.getPhone(), String.class);
        statement = bindNullable(statement, 12, company.getBannerUrl(), String.class);
        return statement.map((row, metadata) -> mapper.toDomain(toEntity(row))).one();
    }

    private CompanyEntity toEntity(Row row) {
        return CompanyEntity.builder()
                .id(row.get("id_empresa", UUID.class))
                .userIdOwner(row.get("id_usuario_propietario", UUID.class))
                .name(row.get("razon_social", String.class))
                .taxId(row.get("nit_identificacion", String.class))
                .logoUrl(row.get("logo_url", String.class))
                .description(row.get("descripcion_tienda", String.class))
                .operationalConfig(row.get("configuracion_operativa", Json.class))
                .address(row.get("direccion_fisica", String.class))
                .latitude(row.get("latitud", Double.class))
                .longitude(row.get("longitud", Double.class))
                .rating(row.get("calificacion_promedio", BigDecimal.class).doubleValue())
                .reviewCount(row.get("total_resenas", Integer.class))
                .active(row.get("activo", Boolean.class))
                .slug(row.get("slug", String.class))
                .phone(row.get("telefono_comercial", String.class))
                .bannerUrl(row.get("banner_url", String.class))
                .createdAt(row.get("fecha_creacion", java.time.LocalDateTime.class))
                .updatedAt(row.get("fecha_actualizacion", java.time.LocalDateTime.class))
                .build();
    }

    private <T> DatabaseClient.GenericExecuteSpec bindNullable(
            DatabaseClient.GenericExecuteSpec statement, int index, T value, Class<T> type) {
        return value == null ? statement.bindNull(index, type) : statement.bind(index, value);
    }

    private String createSlug(String name, UUID id) {
        String normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        String base = normalized.isBlank() ? "company" : normalized;
        return base.substring(0, Math.min(base.length(), 135)) + "-" + id.toString().substring(0, 8);
    }
}
