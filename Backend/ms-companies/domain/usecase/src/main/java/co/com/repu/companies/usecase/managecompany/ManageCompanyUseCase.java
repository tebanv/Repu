package co.com.repu.companies.usecase.managecompany;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.CompanyAccessDeniedException;
import co.com.repu.companies.model.company.CompanySlug;
import co.com.repu.companies.model.company.CompanySlugAlreadyExistsException;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RequiredArgsConstructor
public class ManageCompanyUseCase {

    private final CompanyRepository companyRepository;
    public static final int DEFAULT_RADIUS_KM = 10;

    // Debe aceptar los parámetros de ubicación (pueden llegar nulos)
    public Flux<Company> getAllCompanies(Double lat, Double lng, Integer radiusKm, String messageId) {
        if (lat != null && lng != null) {
            return companyRepository.findNearest(lat, lng,
                    radiusKm == null ? DEFAULT_RADIUS_KM : radiusKm, messageId);
        } else {
            // No hay ubicación: Mostrar todas (idealmente paginado en el futuro)
            return companyRepository.findAll();
        }
    }

    public Mono<Company> createCompany(Company company, String messageId) {
        company.setActive(true);
        if (company.getSlug() == null) {
            return companyRepository.save(company, messageId);
        }
        company.setSlug(CompanySlug.normalize(company.getSlug()));
        return companyRepository.existsBySlug(company.getSlug())
                .flatMap(exists -> exists
                        ? Mono.error(new CompanySlugAlreadyExistsException())
                        : companyRepository.save(company, messageId));
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
                    String requestedSlug = updates.getSlug() == null
                            ? null : CompanySlug.normalize(updates.getSlug());
                    Mono<Boolean> slugExists = requestedSlug == null
                            ? Mono.just(false) : companyRepository.existsBySlug(requestedSlug);
                    return slugExists.flatMap(exists -> {
                        if (exists && !requestedSlug.equals(existingCompany.getSlug())) {
                            return Mono.error(new CompanySlugAlreadyExistsException());
                        }

                        Company updatedCompany = existingCompany.toBuilder()
                                .name(updates.getName() != null ? updates.getName() : existingCompany.getName())
                                .taxId(updates.getTaxId() != null ? updates.getTaxId() : existingCompany.getTaxId())
                                .description(updates.getDescription() != null ? updates.getDescription() : existingCompany.getDescription())
                                .logoUrl(updates.getLogoUrl() != null ? updates.getLogoUrl() : existingCompany.getLogoUrl())
                                .phone(updates.getPhone() != null ? updates.getPhone() : existingCompany.getPhone())
                                .bannerUrl(updates.getBannerUrl() != null ? updates.getBannerUrl() : existingCompany.getBannerUrl())
                                .address(updates.getAddress() != null ? updates.getAddress() : existingCompany.getAddress())
                                .latitude(updates.getLatitude() != null ? updates.getLatitude() : existingCompany.getLatitude())
                                .longitude(updates.getLongitude() != null ? updates.getLongitude() : existingCompany.getLongitude())
                                .operationalConfig(updates.getOperationalConfig() != null
                                        ? updates.getOperationalConfig() : existingCompany.getOperationalConfig())
                                .slug(requestedSlug != null ? requestedSlug : existingCompany.getSlug())
                                .build();

                        return companyRepository.save(updatedCompany, messageId);
                    });
                });
    }

    public Mono<Company> updateStatus(String id, Boolean active, UUID actorId,
                                      boolean administrator, String messageId) {
        return companyRepository.findById(id)
                .flatMap(company -> {
                    if (!administrator && !actorId.equals(company.getUserIdOwner())) {
                        return Mono.error(new CompanyAccessDeniedException());
                    }
                    company.setActive(active);
                    return companyRepository.update(company, messageId);
                });
    }
}
