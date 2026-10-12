package co.com.repu.companies.r2dbc.repository;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.query.ReactiveQueryByExampleExecutor;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import co.com.repu.companies.r2dbc.entity.CompanyEntity;
import reactor.core.publisher.Flux;

// TODO: This file is just an example, you should delete or modify it
public interface CompanyReactiveRepository extends ReactiveCrudRepository<CompanyEntity, String>, ReactiveQueryByExampleExecutor<Object> {

    // $1 = latitudUsuario, $2 = longitudUsuario, $3 = radioEnKm
    // 6371 es el radio de la Tierra en Km.
    @Query("""
        SELECT *, 
        (
            6371 * acos(
                cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2)) + 
                sin(radians($1)) * sin(radians(latitud))
            )
        ) as distancia
        FROM empresas
        WHERE 
        (
            6371 * acos(
                cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2)) + 
                sin(radians($1)) * sin(radians(latitud))
            )
        ) < $3
        ORDER BY distancia ASC
    """)
    Flux<CompanyEntity> findNearest(double lat, double lng, double radiusKm);

}
