package co.com.repu.companies.model.company.gateways;

import co.com.repu.companies.model.company.Company;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

public interface CompanyRepository {
    Mono<Company> save(Company company, String messageId);
    Mono<Company> findById(String id);
    Mono<Company> findBySlug(String slug);
    Mono<Boolean> existsBySlug(String slug);
    Flux<Company> findAll(); // Más adelante agregaremos filtros (paginación, geo)
    Flux<Company> findAllVisible(UUID ownerId, boolean administrator);
    Mono<Company> findBySlugVisible(String slug, UUID ownerId, boolean administrator);
    Mono<Company> update(Company company, String messageId);
    /**
     * Busca empresas cercanas a una coordenada.
     * @param lat Latitud del usuario
     * @param lng Longitud del usuario
     * @param radiusKm Radio de búsqueda en Kilómetros
     * @return Empresas ordenadas por cercanía
     */
    Flux<Company> findNearest(double lat, double lng, int radiusKm, String messageId);
    Flux<Company> findNearestVisible(double lat, double lng, int radiusKm, UUID ownerId,
                                     boolean administrator, String messageId);
}