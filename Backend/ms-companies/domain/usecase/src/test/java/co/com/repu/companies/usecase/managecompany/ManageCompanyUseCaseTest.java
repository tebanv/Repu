package co.com.repu.companies.usecase.managecompany;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.model.company.CompanyAccessDeniedException;
import co.com.repu.companies.model.company.gateways.CompanyRepository;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ManageCompanyUseCaseTest {

    @Test
    void shouldRejectUpdateWhenActorIsNotCompanyOwner() {
        CompanyRepository repository = mock(CompanyRepository.class);
        UUID ownerId = UUID.randomUUID();
        Company existing = Company.builder()
                .id(UUID.randomUUID().toString())
                .userIdOwner(ownerId)
                .name("Existing")
                .build();
        when(repository.findById(existing.getId())).thenReturn(Mono.just(existing));

        StepVerifier.create(new ManageCompanyUseCase(repository).updateCompanyDetails(
                        existing.getId(), Company.builder().name("Tampered").build(),
                        UUID.randomUUID(), false, "request-id"))
                .expectError(CompanyAccessDeniedException.class)
                .verify();

        verify(repository, never()).save(any(Company.class), any());
    }

    @Test
    void shouldAllowOwnerToUpdateCompany() {
        CompanyRepository repository = mock(CompanyRepository.class);
        UUID ownerId = UUID.randomUUID();
        Company existing = Company.builder()
                .id(UUID.randomUUID().toString())
                .userIdOwner(ownerId)
                .name("Existing")
                .slug("existing")
                .build();
        Company updated = existing.toBuilder().name("Updated").build();
        when(repository.findById(existing.getId())).thenReturn(Mono.just(existing));
        when(repository.save(any(Company.class), eq("request-id"))).thenReturn(Mono.just(updated));

        StepVerifier.create(new ManageCompanyUseCase(repository).updateCompanyDetails(
                        existing.getId(), Company.builder().name("Updated").build(),
                        ownerId, false, "request-id"))
                .expectNextMatches(company -> "Updated".equals(company.getName()))
                .verifyComplete();
    }

    @Test
    void shouldAllowAdministratorToUpdateCompany() {
        CompanyRepository repository = mock(CompanyRepository.class);
        Company existing = Company.builder()
                .id(UUID.randomUUID().toString())
                .userIdOwner(UUID.randomUUID())
                .name("Existing")
                .slug("existing")
                .build();
        Company updated = existing.toBuilder().name("Updated").build();
        when(repository.findById(existing.getId())).thenReturn(Mono.just(existing));
        when(repository.save(any(Company.class), eq("request-id"))).thenReturn(Mono.just(updated));

        StepVerifier.create(new ManageCompanyUseCase(repository).updateCompanyDetails(
                        existing.getId(), Company.builder().name("Updated").build(),
                        UUID.randomUUID(), true, "request-id"))
                .expectNextMatches(company -> "Updated".equals(company.getName()))
                .verifyComplete();
    }

    @Test
    void shouldRejectUpdateWithoutActor() {
        CompanyRepository repository = mock(CompanyRepository.class);

        StepVerifier.create(new ManageCompanyUseCase(repository).updateCompanyDetails(
                        UUID.randomUUID().toString(), Company.builder().name("Tampered").build(),
                        null, true, "request-id"))
                .expectError(CompanyAccessDeniedException.class)
                .verify();

        verify(repository, never()).findById(any());
    }

    @Test
    void shouldPassVisibilityScopeToPublicListingQueries() {
        CompanyRepository repository = mock(CompanyRepository.class);
        ManageCompanyUseCase useCase = new ManageCompanyUseCase(repository);
        UUID ownerId = UUID.randomUUID();
        when(repository.findAllVisible(null, false)).thenReturn(Flux.empty());
        when(repository.findAllVisible(null, true)).thenReturn(Flux.empty());
        when(repository.findNearestVisible(6.2, -75.5, 5, ownerId, false, "request-id"))
                .thenReturn(Flux.empty());

        StepVerifier.create(useCase.getAllCompanies(null, null, null, null, false, "request-id"))
                .verifyComplete();
        StepVerifier.create(useCase.getAllCompanies(6.2, -75.5, 5, ownerId, false, "request-id"))
                .verifyComplete();
        StepVerifier.create(useCase.getAllCompanies(null, null, null, null, true, "request-id"))
                .verifyComplete();

        verify(repository).findAllVisible(null, false);
        verify(repository).findNearestVisible(6.2, -75.5, 5, ownerId, false, "request-id");
        verify(repository).findAllVisible(null, true);
    }

    @Test
    void shouldScopeCompanySlugLookupByVisibility() {
        CompanyRepository repository = mock(CompanyRepository.class);
        ManageCompanyUseCase useCase = new ManageCompanyUseCase(repository);
        UUID ownerId = UUID.randomUUID();
        when(repository.findBySlugVisible("store", ownerId, false)).thenReturn(Mono.empty());
        when(repository.findBySlugVisible("store", null, true)).thenReturn(Mono.empty());

        StepVerifier.create(useCase.getCompanyBySlug("store", ownerId, false)).verifyComplete();
        StepVerifier.create(useCase.getCompanyBySlug("store", null, true)).verifyComplete();

        verify(repository).findBySlugVisible("store", ownerId, false);
        verify(repository).findBySlugVisible("store", null, true);
    }
}
