package co.com.repu.companies.api;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.usecase.managecompany.ManageCompanyUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class Handler {

    private final ManageCompanyUseCase manageCompanyUseCase;

    /**
     * GET /companies?lat=...&lng=...
     * Lista empresas, opcionalmente filtradas por ubicación.
     */
    public Mono<ServerResponse> getAllCompanies(ServerRequest request) {
        // Extraemos query params de forma segura (pueden ser nulos)
        Double lat = request.queryParam("lat").map(Double::valueOf).orElse(null);
        Double lng = request.queryParam("lng").map(Double::valueOf).orElse(null);

        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(manageCompanyUseCase.getAllCompanies(lat, lng), Company.class);
    }

    /**
     * POST /companies
     * Crea una nueva empresa. Retorna 201 Created.
     */
    public Mono<ServerResponse> createCompany(ServerRequest request) {
        return request.bodyToMono(Company.class)
                .flatMap(manageCompanyUseCase::createCompany)
                .flatMap(company -> ServerResponse
                        .status(201) // Importante: HTTP 201 para creaciones
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(company));
    }

    /**
     * PATCH /companies/{companyId}/status
     * Actualiza solo el estado (activo/inactivo).
     */
    public Mono<ServerResponse> updateStatus(ServerRequest request) {
        String companyId = request.pathVariable("companyId");

        // Usamos una clase auxiliar DTO interna o Map para capturar el body pequeño
        return request.bodyToMono(StatusDTO.class)
                .flatMap(dto -> manageCompanyUseCase.updateStatus(companyId, dto.active))
                .flatMap(company -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(company));
    }

    // DTO interno simple para mapear el body del PATCH sin ensuciar el Dominio
    // JSON esperado: { "active": true }
    public record StatusDTO(Boolean active) {}
}