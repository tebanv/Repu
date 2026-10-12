package co.com.repu.companies.usecase.managecompany;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageCompanyUseCase {

    private final CompanyRepository companyRepository;
    private static final int DEFAULT_RADIUS_KM = 10;

    // Debe aceptar los parámetros de ubicación (pueden llegar nulos)
    public Flux<Company> getAllCompanies(Double lat, Double lng, String messageId) {
        if (lat != null && lng != null) {
            // El usuario nos dio su ubicación: Mostrar cercanas primero
            return companyRepository.findNearest(lat, lng, DEFAULT_RADIUS_KM, messageId);
        } else {
            // No hay ubicación: Mostrar todas (idealmente paginado en el futuro)
            return companyRepository.findAll();
        }
    }

    public Mono<Company> createCompany(Company company, String messageId) {
        // Reglas de negocio antes de guardar
        company.setActive(true);
        return companyRepository.save(company, messageId);
    }

    /**
     * Actualiza parcialmente una empresa.
     * Solo los campos no nulos en 'updates' sobrescribirán a 'existing'.
     */
    public Mono<Company> updateCompanyDetails(String id, Company updates, String messageId) {
        return companyRepository.findById(id)
                .flatMap(existingCompany -> {
                    // LÓGICA DE MEZCLA (MERGE)
                    // Usamos el toBuilder() de Lombok para crear una copia actualizada
                    Company updatedCompany = existingCompany.toBuilder()
                            .name(updates.getName() != null ? updates.getName() : existingCompany.getName())
                            .taxId(updates.getTaxId() != null ? updates.getTaxId() : existingCompany.getTaxId())
                            .description(updates.getDescription() != null ? updates.getDescription() : existingCompany.getDescription())
                            .logoUrl(updates.getLogoUrl() != null ? updates.getLogoUrl() : existingCompany.getLogoUrl())
                            .address(updates.getAddress() != null ? updates.getAddress() : existingCompany.getAddress())
                            .latitude(updates.getLatitude() != null ? updates.getLatitude() : existingCompany.getLatitude())
                            .longitude(updates.getLongitude() != null ? updates.getLongitude() : existingCompany.getLongitude())
                            // Ojo: Si operationalConfig viene, reemplaza al anterior completo.
                            // Si quisieras "merge profundo" de JSON, requeriría lógica extra compleja.
                            .operationalConfig(updates.getOperationalConfig() != null ? updates.getOperationalConfig() : existingCompany.getOperationalConfig())
                            .build();

                    return companyRepository.save(updatedCompany, messageId);
                });
    }

    public Mono<Company> updateStatus(String id, Boolean active, String messageId) {
        // Lógica para buscar, cambiar estado y guardar
        return companyRepository.findById(id)
                .flatMap(company -> {
                    company.setActive(active);
                    return companyRepository.update(company, messageId);
                });
    }
}
