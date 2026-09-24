package co.com.repu.r2dbc;

import co.com.repu.model.user.UserAddress;
import co.com.repu.model.user.gateways.UserAddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class UserAddressRepositoryAdapter implements UserAddressRepository {

    private final DatabaseClient databaseClient;

    private static final String SELECT_COLUMNS = """
            id_direccion, id_usuario, nombre_direccion, direccion_completa, ciudad,
            codigo_postal, es_principal, public.ST_Y(CAST(ubicacion AS public.geometry)) AS latitud,
            public.ST_X(CAST(ubicacion AS public.geometry)) AS longitud, notas_entrega, activo,
            fecha_creacion, fecha_actualizacion
            """;

    @Override
    public Flux<UserAddress> findActiveByUserId(UUID userId) {
        return databaseClient.sql("SELECT " + SELECT_COLUMNS
                        + " FROM repu.direcciones_usuario WHERE id_usuario = $1 AND activo = TRUE "
                        + "ORDER BY es_principal DESC, fecha_creacion ASC")
                .bind(0, userId)
                .map((row, metadata) -> map(row))
                .all();
    }

    @Override
    public Mono<UserAddress> findActiveByIdAndUserId(UUID addressId, UUID userId) {
        return databaseClient.sql("SELECT " + SELECT_COLUMNS
                        + " FROM repu.direcciones_usuario WHERE id_direccion = $1 "
                        + "AND id_usuario = $2 AND activo = TRUE")
                .bind(0, addressId)
                .bind(1, userId)
                .map((row, metadata) -> map(row))
                .one();
    }

    @Override
    public Mono<UserAddress> save(UserAddress address) {
        Mono<Void> clearPrimary;
        if (!Boolean.TRUE.equals(address.getPrimary())) {
            clearPrimary = Mono.empty();
        } else if (address.getId() == null) {
            clearPrimary = databaseClient.sql("UPDATE repu.direcciones_usuario SET es_principal = FALSE "
                            + "WHERE id_usuario = $1")
                    .bind(0, address.getUserId())
                    .fetch().rowsUpdated().then();
        } else {
            clearPrimary = databaseClient.sql("UPDATE repu.direcciones_usuario SET es_principal = FALSE "
                            + "WHERE id_usuario = $1 AND id_direccion <> $2")
                    .bind(0, address.getUserId())
                    .bind(1, address.getId())
                    .fetch().rowsUpdated().then();
        }

        if (address.getId() == null) {
            var statement = databaseClient.sql("""
                    INSERT INTO repu.direcciones_usuario
                    (id_usuario, nombre_direccion, direccion_completa, ciudad, codigo_postal,
                     es_principal, ubicacion, notas_entrega, activo)
                    VALUES ($1, $2, $3, $4, $5, $6,
                            CAST(public.ST_SetSRID(public.ST_MakePoint($7, $8), 4326) AS public.geography),
                            $9, TRUE)
                    RETURNING
                    id_direccion, id_usuario, nombre_direccion, direccion_completa, ciudad,
                    codigo_postal, es_principal, public.ST_Y(CAST(ubicacion AS public.geometry)) AS latitud,
                    public.ST_X(CAST(ubicacion AS public.geometry)) AS longitud, notas_entrega, activo,
                    fecha_creacion, fecha_actualizacion
                    """)
                    .bind(0, address.getUserId())
                    .bind(1, address.getName())
                    .bind(2, address.getFullAddress())
                    .bind(3, address.getCity())
                    .bind(5, Boolean.TRUE.equals(address.getPrimary()))
                    .bind(6, address.getLongitude())
                    .bind(7, address.getLatitude())
                    ;
            statement = bindNullable(statement, 4, address.getPostalCode(), String.class);
            statement = bindNullable(statement, 8, address.getDeliveryNotes(), String.class);
            return clearPrimary.then(statement.map((row, metadata) -> map(row)).one());
        }

        var statement = databaseClient.sql("""
                UPDATE repu.direcciones_usuario
                SET nombre_direccion = $3, direccion_completa = $4, ciudad = $5,
                codigo_postal = $6, es_principal = $7,
                ubicacion = CAST(public.ST_SetSRID(public.ST_MakePoint($8, $9), 4326) AS public.geography),
                notas_entrega = $10
                WHERE id_direccion = $1 AND id_usuario = $2 AND activo = TRUE
                RETURNING
                id_direccion, id_usuario, nombre_direccion, direccion_completa, ciudad,
                codigo_postal, es_principal, public.ST_Y(CAST(ubicacion AS public.geometry)) AS latitud,
                public.ST_X(CAST(ubicacion AS public.geometry)) AS longitud, notas_entrega, activo,
                fecha_creacion, fecha_actualizacion
                """)
                .bind(0, address.getId())
                .bind(1, address.getUserId())
                .bind(2, address.getName())
                .bind(3, address.getFullAddress())
                .bind(4, address.getCity())
                .bind(6, Boolean.TRUE.equals(address.getPrimary()))
                .bind(7, address.getLongitude())
                .bind(8, address.getLatitude())
                ;
        statement = bindNullable(statement, 5, address.getPostalCode(), String.class);
        statement = bindNullable(statement, 9, address.getDeliveryNotes(), String.class);
        return clearPrimary.then(statement.map((row, metadata) -> map(row)).one());
    }

    @Override
    public Mono<Boolean> deactivate(UUID addressId, UUID userId) {
        return databaseClient.sql("UPDATE repu.direcciones_usuario SET activo = FALSE "
                        + "WHERE id_direccion = $1 AND id_usuario = $2 AND activo = TRUE")
                .bind(0, addressId)
                .bind(1, userId)
                .fetch().rowsUpdated()
                .map(rows -> rows > 0);
    }

    private <T> DatabaseClient.GenericExecuteSpec bindNullable(
            DatabaseClient.GenericExecuteSpec statement, int index, T value, Class<T> type) {
        return value == null ? statement.bindNull(index, type) : statement.bind(index, value);
    }

    private UserAddress map(io.r2dbc.spi.Row row) {
        return UserAddress.builder()
                .id(row.get("id_direccion", UUID.class))
                .userId(row.get("id_usuario", UUID.class))
                .name(row.get("nombre_direccion", String.class))
                .fullAddress(row.get("direccion_completa", String.class))
                .city(row.get("ciudad", String.class))
                .postalCode(row.get("codigo_postal", String.class))
                .primary(row.get("es_principal", Boolean.class))
                .latitude(row.get("latitud", Double.class))
                .longitude(row.get("longitud", Double.class))
                .deliveryNotes(row.get("notas_entrega", String.class))
                .active(row.get("activo", Boolean.class))
                .createdAt(row.get("fecha_creacion", LocalDateTime.class))
                .updatedAt(row.get("fecha_actualizacion", LocalDateTime.class))
                .build();
    }
}
