package co.com.repu.companies.usecase.managecompany;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageCompanyUseCase {

    private final CompanyRepository companyRepository;

    // Debe aceptar los parámetros de ubicación (pueden llegar nulos)
    public Flux<Company> getAllCompanies(Double lat, Double lng) {
        // Por ahora retornamos todo, luego implementamos lógica geoespacial
        return companyRepository.findAll();
    }

    public Mono<Company> createCompany(Company company) {
        // Reglas de negocio antes de guardar
        company.setActive(true);
        return companyRepository.save(company);
    }

    public Mono<Company> updateStatus(String id, Boolean active) {
        // Lógica para buscar, cambiar estado y guardar
        return companyRepository.findById(id)
                .flatMap(company -> {
                    company.setActive(active);
                    return companyRepository.update(company);
                });
    }
}
