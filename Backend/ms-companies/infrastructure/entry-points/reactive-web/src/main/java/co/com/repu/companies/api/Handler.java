package co.com.repu.companies.api;

import co.com.repu.companies.model.company.Company;
import co.com.repu.companies.usecase.managecompany.ManageCompanyUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // 1. Logging
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.util.UUID;
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
        String radiusStr = request.queryParam("radiusKm").orElse(null);

        // 2. Validación de coherencia: Si envían uno, deben enviar el otro
        if ((latStr != null && lngStr == null) || (latStr == null && lngStr != null)) {
            return ServerResponse.badRequest()
                    .bodyValue(Map.of("error", "Both 'lat' and 'lng' are required for geolocation search."));
        }
        if (radiusStr != null && latStr == null) {
            return ServerResponse.badRequest()
                    .bodyValue(Map.of("error", "'radiusKm' requires both 'lat' and 'lng'."));
        }

        Double lat = null;
        Double lng = null;
        Integer radiusKm = null;

        try {
            if (latStr != null) {
                lat = Double.valueOf(latStr);
                lng = Double.valueOf(lngStr);

                // 3. Validación de rangos geográficos reales
                if (!Double.isFinite(lat) || !Double.isFinite(lng)
                        || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    return ServerResponse.badRequest()
                            .bodyValue(Map.of("error", "Coordinates out of range. Lat: [-90, 90], Lng: [-180, 180]"));
                }
            }
            if (radiusStr != null) {
                radiusKm = Integer.valueOf(radiusStr);
                if (radiusKm <= 0) {
                    return ServerResponse.badRequest()
                            .bodyValue(Map.of("error", "'radiusKm' must be a positive integer."));
                }
            }
        } catch (NumberFormatException e) {
            return ServerResponse.badRequest()
                    .bodyValue(Map.of("error", "Coordinates and radiusKm must be numeric values."));
        }


        log.info("Se recibe peticion para listar empresas. Busqueda GeoEspacial: {}, messageId: {}", lat != null, messageId);

        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(manageCompanyUseCase.getAllCompanies(lat, lng, radiusKm, messageId)
                        .map(Handler::toResponse), CompanyResponse.class)
                .doOnError(e -> log.error("Error fetching companies: {}, messageId: {}", e, messageId));
    }

    /**
     * POST /companies
     * Crea empresa. Valida campos obligatorios.
     */
    public Mono<ServerResponse> createCompany(ServerRequest request) {
        // 1. Extraer el ID (Si falla, devuelve 400 Bad Request automáticamente)
        String messageId = getRequestId(request);

        return request.principal()
                .flatMap(principal -> {
                    UUID ownerId;
                    try {
                        ownerId = UUID.fromString(principal.getName());
                    } catch (IllegalArgumentException e) {
                        return ServerResponse.status(HttpStatus.UNAUTHORIZED)
                                .bodyValue(Map.of("error", "Authenticated user identity is invalid."));
                    }

                    return request.bodyToMono(CompanyInput.class)
                            .flatMap(input -> {
                                String validationError = validateInput(input);
                                if (validationError != null) {
                                    return ServerResponse.badRequest()
                                            .bodyValue(Map.of("error", validationError));
                                }

                                Company company = toDomain(input, ownerId);
                                log.info("Creando empresa para propietario {}, messageId: {}", ownerId, messageId);
                                return manageCompanyUseCase.createCompany(company, messageId)
                                        .flatMap(created -> ServerResponse
                                                .status(HttpStatus.CREATED)
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .bodyValue(toResponse(created)));
                            });
                })
                .switchIfEmpty(Mono.defer(() -> ServerResponse.status(HttpStatus.UNAUTHORIZED).build()))
                .doOnError(e -> log.error("Error creating company, messageId: {}", messageId, e));
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
                                    .bodyValue(toResponse(company)))
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

        return request.bodyToMono(CompanyUpdateRequest.class)
                .flatMap(updates -> {
                    String validationError = validateUpdate(updates);
                    if (validationError != null) {
                        return ServerResponse.badRequest().bodyValue(Map.of("error", validationError));
                    }
                    log.info("Peticion para actualizar detalle a la empresa ID: {}, messageId: {}",
                            companyId, messageId);

                    return manageCompanyUseCase.updateCompanyDetails(companyId, toUpdateDomain(updates), messageId)
                            .flatMap(updatedCompany -> {
                                log.info("Empresa ID: {} actualizada satisfactoriamente, messageId: {}",
                                        companyId, messageId);
                                return ServerResponse.ok()
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .bodyValue(toResponse(updatedCompany));
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

    public record PointCoordinates(Double latitude, Double longitude) {}

    public record CompanyInput(
            String businessName,
            String taxId,
            String description,
            String logoUrl,
            String phone,
            String bannerUrl,
            String physicalAddress,
            PointCoordinates location,
            Object operationalConfig) {}

    public record CompanyUpdateRequest(
            String businessName,
            String description,
            String logoUrl,
            String phone,
            String bannerUrl,
            String physicalAddress,
            PointCoordinates location,
            Object operationalConfig) {}

    public record CompanyResponse(
            String id,
            UUID ownerUserId,
            String businessName,
            String taxId,
            String description,
            String logoUrl,
            String phone,
            String bannerUrl,
            String physicalAddress,
            PointCoordinates location,
            Object operationalConfig,
            Double rating,
            Integer reviewCount,
            Boolean active,
            String slug) {}

    private static String validateInput(CompanyInput input) {
        if (input.businessName() == null || input.businessName().isBlank()) return "businessName is required.";
        if (input.taxId() == null || input.taxId().isBlank()) return "taxId is required.";
        if (input.physicalAddress() == null || input.physicalAddress().isBlank()) return "physicalAddress is required.";
        return validateLocation(input.location());
    }

    private static String validateUpdate(CompanyUpdateRequest input) {
        if (input.businessName() != null && input.businessName().isBlank()) return "businessName cannot be blank.";
        if (input.physicalAddress() != null && input.physicalAddress().isBlank()) {
            return "physicalAddress cannot be blank.";
        }
        return input.location() == null ? null : validateLocation(input.location());
    }

    private static String validateLocation(PointCoordinates location) {
        if (location == null || location.latitude() == null || location.longitude() == null) {
            return "location.latitude and location.longitude are required.";
        }
        if (!Double.isFinite(location.latitude()) || !Double.isFinite(location.longitude())
                || location.latitude() < -90 || location.latitude() > 90
                || location.longitude() < -180 || location.longitude() > 180) {
            return "location coordinates are out of range.";
        }
        return null;
    }

    private static Company toDomain(CompanyInput input, UUID ownerId) {
        return Company.builder()
                .userIdOwner(ownerId)
                .name(input.businessName())
                .taxId(input.taxId())
                .description(input.description())
                .logoUrl(input.logoUrl())
                .phone(input.phone())
                .bannerUrl(input.bannerUrl())
                .address(input.physicalAddress())
                .latitude(input.location().latitude())
                .longitude(input.location().longitude())
                .operationalConfig(input.operationalConfig())
                .build();
    }

    private static Company toUpdateDomain(CompanyUpdateRequest input) {
        return Company.builder()
                .name(input.businessName())
                .description(input.description())
                .logoUrl(input.logoUrl())
                .phone(input.phone())
                .bannerUrl(input.bannerUrl())
                .address(input.physicalAddress())
                .latitude(input.location() == null ? null : input.location().latitude())
                .longitude(input.location() == null ? null : input.location().longitude())
                .operationalConfig(input.operationalConfig())
                .build();
    }

    private static CompanyResponse toResponse(Company company) {
        PointCoordinates location = company.getLatitude() == null || company.getLongitude() == null
                ? null : new PointCoordinates(company.getLatitude(), company.getLongitude());
        return new CompanyResponse(company.getId(), company.getUserIdOwner(), company.getName(),
                company.getTaxId(), company.getDescription(), company.getLogoUrl(), company.getPhone(),
                company.getBannerUrl(), company.getAddress(), location, company.getOperationalConfig(),
                company.getRating(), company.getReviewCount(), company.getActive(), company.getSlug());
    }
}