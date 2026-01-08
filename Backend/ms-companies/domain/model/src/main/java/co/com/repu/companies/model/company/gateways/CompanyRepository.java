package co.com.repu.companies.model.company.gateways;

import co.com.repu.companies.model.company.Company;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface CompanyRepository {
    Mono<Company> save(Company company);
    Mono<Company> findById(String id);
    Flux<Company> findAll(); // Más adelante agregaremos filtros (paginación, geo)
    Mono<Company> update(Company company);
}