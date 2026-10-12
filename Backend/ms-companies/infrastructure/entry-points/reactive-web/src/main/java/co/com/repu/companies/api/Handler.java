package co.com.repu.companies.api;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.usecase.managecompany.ManageCompanyUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // 1. Logging
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j // Habilita 'log'
@Component
@RequiredArgsConstructor
public class Handler {

    private static final String HEADER_REQUEST_ID = "X-Request-ID";

    private final ManageCompanyUseCase manageCompanyUseCase;

    // Regex para validar formato UUID básico
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    /**
     * GET /companies?lat=...&lng=...
     * Lista empresas. Valida rangos de coordenadas.
     */
    public Mono<ServerResponse> getAllCompanies(ServerRequest request) {

        String messageId = getRequestId(request);

        String latStr = request.queryParam("lat").orElse(null);
        String lngStr = request.queryParam("lng").orElse(null);

        // 2. Validación de coherencia: Si envían uno, deben enviar el otro
        if ((latStr != null && lngStr == null) || (latStr == null && lngStr != null)) {
            return ServerResponse.badRequest()
                    .bodyValue(Map.of("error", "Both 'lat' and 'lng' are required for geolocation search."));
        }

        Double lat = null;
        Double lng = null;

        try {
            if (latStr != null) {
                lat = Double.valueOf(latStr);
                lng = Double.valueOf(lngStr);

                // 3. Validación de rangos geográficos reales
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    return ServerResponse.badRequest()
                            .bodyValue(Map.of("error", "Coordinates out of range. Lat: [-90, 90], Lng: [-180, 180]"));
                }
            }
        } catch (NumberFormatException e) {
            return ServerResponse.badRequest().bodyValue(Map.of("error", "Coordinates must be numeric values."));
        }


        log.info("Se recibe peticion para listar empresas. Busqueda GeoEspacial: {}, messageId: {}", lat != null, messageId);

        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(manageCompanyUseCase.getAllCompanies(lat, lng, messageId), Company.class)
                .doOnError(e -> log.error("Error fetching companies: {}, messageId: {}", e, messageId));
    }

    /**
     * POST /companies
     * Crea empresa. Valida campos obligatorios.
     */
    public Mono<ServerResponse> createCompany(ServerRequest request) {
        // 1. Extraer el ID (Si falla, devuelve 400 Bad Request automáticamente)
        String messageId = getRequestId(request);

        return request.bodyToMono(Company.class)
                .flatMap(company -> {
                    // 4. Validación Manual Simple (O podrías usar Validator de Spring)
                    if (company.getName() == null || company.getName().isBlank()) {
                        return ServerResponse.badRequest().bodyValue(Map.of("error", "Field 'name' is required"));
                    }
                    if (company.getTaxId() == null || company.getTaxId().isBlank()) {
                        return ServerResponse.badRequest().bodyValue(Map.of("error", "Field 'taxId' is required"));
                    }

                    log.info("Peticion para crear empresa: {} - TaxID: {}, message-id: {}", company.getName(), company.getTaxId(), messageId);

                    return manageCompanyUseCase.createCompany(company, messageId)
                            .flatMap(created -> {
                                log.info("Company created successfully with ID: {}, messageId: {}", created.getId(), messageId);
                                return ServerResponse
                                        .created(URI.create("/companies/" + created.getId())) // Header Location
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .bodyValue(created);
                            });
                })
                .doOnError(e -> log.error("Error creating company: {}, message-id: {}", e, messageId));
    }

    /**
     * PATCH /companies/{companyId}/status
     * Actualiza estado. Maneja 404 y validación de UUID.
     */
    public Mono<ServerResponse> updateStatus(ServerRequest request) {

        String messageId = getRequestId(request);
        String companyId = request.pathVariable("companyId");

        // 5. Validación de formato UUID para evitar ir a BD con basura
        if (!UUID_PATTERN.matcher(companyId).matches()) {
            return ServerResponse.badRequest().bodyValue(Map.of("error", "Invalid UUID format"));
        }

        return request.bodyToMono(StatusDTO.class)
                .flatMap(dto -> {
                    if (dto.active() == null) {
                        return ServerResponse.badRequest().bodyValue(Map.of("error", "Field 'active' is required"));
                    }

                    log.info("Actualizando estado para Empresa ID: {} a {}, messageId: {}",
                            companyId, dto.active(), messageId);

                    return manageCompanyUseCase.updateStatus(companyId, dto.active(), messageId)
                            .flatMap(company -> ServerResponse.ok()
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .bodyValue(company))
                            // 6. Manejo de 404: Si el UseCase retorna vacío (no encontró empresa)
                            .switchIfEmpty(Mono.defer(() -> {
                                log.warn("Empresa con ID {} no fue encontrada para acutalizar el estado, messageId: {}",
                                        companyId, messageId);
                                return ServerResponse.notFound().build();
                            }));
                })
                .doOnError(e -> log.error("Error updating company status", e));
    }

    /**
     * PATCH /companies/{companyId}
     * Actualiza datos básicos (Nombre, Dirección, Logo, Config).
     */
    public Mono<ServerResponse> updateCompanyDetails(ServerRequest request) {

        String messageId = getRequestId(request);
        String companyId = request.pathVariable("companyId");

        // 1. Validación de Seguridad básica (Formato UUID)
        if (!UUID_PATTERN.matcher(companyId).matches()) {
            return ServerResponse.badRequest()
                    .bodyValue(Map.of("error", "Invalid UUID format for Company ID"));
        }

        return request.bodyToMono(Company.class)
                .flatMap(updates -> {
                    log.info("Peticion para actualizar detalle a la empresa ID: {}, messageId: {}",
                            companyId, messageId);

                    return manageCompanyUseCase.updateCompanyDetails(companyId, updates, messageId)
                            .flatMap(updatedCompany -> {
                                log.info("Empresa ID: {} actualizada satisfactoriamente, messageId: {}",
                                        companyId, messageId);
                                return ServerResponse.ok()
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .bodyValue(updatedCompany);
                            })
                            // 4. Manejo de 404 Not Found
                            .switchIfEmpty(Mono.defer(() -> {
                                log.warn("Fallo la actualizacion: Empresa ID {} no encontrada, messageId: {}",
                                        companyId, messageId);
                                return ServerResponse.notFound().build();
                            }));
                })
                .doOnError(e -> log.error("System error updating company details", e));
    }

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID)
                .stream()
                .findFirst()
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Missing required header: " + HEADER_REQUEST_ID
                ));
    }

    public record StatusDTO(Boolean active) {}
}