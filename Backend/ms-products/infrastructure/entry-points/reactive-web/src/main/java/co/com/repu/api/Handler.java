package co.com.repu.api;

import co.com.repu.model.product.Product;
import co.com.repu.model.product.ProductActor;
import co.com.repu.usecase.manageproducts.ManageProductUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class Handler {

    private final ManageProductUseCase useCase;
    private static final String HEADER_REQUEST_ID = "X-Request-ID";
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F-]{36}$");

    /**
     * GET /catalog/products
     */
    public Mono<ServerResponse> searchProducts(ServerRequest request) {
        String requestId = getRequestId(request);

        // 1. Extraer Params
        String companyId = request.queryParam("companyId").orElse(null);
        String categoryId = request.queryParam("categoryId").orElse(null);
        String attributesEncoded = request.queryParam("attributes").orElse(null);

        // 2. Validaciones
        if (companyId == null || !UUID_PATTERN.matcher(companyId).matches()) {
            return ServerResponse.badRequest().bodyValue(
                    new ErrorResponse("INVALID_REQUEST", "CompanyID válido es requerido."));
        }

        // 3. Decodificar JSON attributes (URL Encoded -> JSON String)
        String attributesJson = null;
        if (attributesEncoded != null) {
            try {
                attributesJson = URLDecoder.decode(attributesEncoded, StandardCharsets.UTF_8);
                // Opcional: Validar que sea un JSON válido usando Jackson aquí
            } catch (Exception e) {
                return ServerResponse.badRequest().bodyValue(
                        new ErrorResponse("INVALID_REQUEST", "Formato de atributos JSON inválido."));
            }
        }
        String decodedAttributesJson = attributesJson;

        log.info("Se recibe peticion para listar productos de empresaId: {}, categoria: {}, con filtros: {}, " +
                        "messsageId: {}",  companyId, categoryId, decodedAttributesJson, requestId);

        return optionalActorFromRequest(request)
                .defaultIfEmpty(ProductActor.publicUser())
                .flatMap(actor -> ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(useCase.searchProducts(companyId, categoryId, decodedAttributesJson, actor), Product.class))
                .doOnError(e -> log.error("[ReqID: {}] Error buscando productos", requestId, e));
    }

    /**
     * POST /catalog/products
     */
    public Mono<ServerResponse> createProduct(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.bodyToMono(Product.class)
                .flatMap(product -> {
                    if (product.getCompanyId() == null || product.getCategoryId() == null
                            || product.getName() == null || product.getPrice() == null) {
                        return Mono.error(new IllegalArgumentException(
                                "CompanyId, CategoryId, Name y Price son obligatorios."));
                    }
                    log.info("Se recibe solicitud para crear un producto: {}, messageId: {}", product.getName(), requestId);
                    return actorFromRequest(request)
                            .flatMap(actor -> useCase.createProduct(product, actor, requestId));
                })
                .flatMap(created -> ServerResponse.created(URI.create("/catalog/products/" + created.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(created))
                .onErrorResume(e -> handleError(e, requestId));
    }

    /**
     * PATCH /catalog/products/{id}
     */
    public Mono<ServerResponse> updateProduct(ServerRequest request) {
        String requestId = getRequestId(request);
        String productId = request.pathVariable("productId");

        return request.bodyToMono(Product.class)
                .flatMap(updates -> {
                    log.info("[ReqID: {}] Actualizando producto {}", requestId, productId);
                    return actorFromRequest(request)
                            .flatMap(actor -> useCase.updateProductDetails(productId, updates, actor, requestId));
                })
                .flatMap(updated -> ServerResponse.ok().bodyValue(updated))
                .switchIfEmpty(ServerResponse.notFound().build())
                .onErrorResume(e -> handleError(e, requestId));
    }

    /**
     * PATCH /catalog/products/{productId}/status
     * Admin/Distributor cambia estado.
     */
    public Mono<ServerResponse> updateStatus(ServerRequest request) {
        String requestId = getRequestId(request);
        String productId = request.pathVariable("productId");

        // Validar formato UUID
        if (!UUID_PATTERN.matcher(productId).matches()) {
            return ServerResponse.badRequest()
                    .bodyValue(new ErrorResponse("INVALID_REQUEST", "ID de producto inválido"));
        }

        // Usamos un record local o StatusUpdateDTO global
        return request.bodyToMono(StatusDTO.class)
                .flatMap(dto -> {
                    if (dto.active()  == null) {
                        return ServerResponse.badRequest().bodyValue(
                                new ErrorResponse("INVALID_REQUEST", "El campo 'active' es requerido"));
                    }

                    log.info("[ReqID: {}] Cambiando estado de producto {} a {}", requestId, productId, dto.active());
                    return actorFromRequest(request)
                            .flatMap(actor -> useCase.updateStatus(productId, dto.active(), actor, requestId));
                })
                .flatMap(updated -> ServerResponse.ok().bodyValue(updated))
                .switchIfEmpty(ServerResponse.notFound().build())
                .onErrorResume(e -> handleError(e, requestId));
    }

    // --- Helpers y DTOs Internos ---

    private Mono<ServerResponse> handleError(Throwable e, String requestId) {
        return ApiErrorHandler.handle(e, requestId);
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

    private Mono<ProductActor> actorFromRequest(ServerRequest request) {
        return optionalActorFromRequest(request)
                .switchIfEmpty(Mono.error(new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Authentication is required")));
    }

    private Mono<ProductActor> optionalActorFromRequest(ServerRequest request) {
        return request.principal()
                .ofType(Authentication.class)
                .filter(authentication -> authentication.isAuthenticated()
                        && !(authentication instanceof AnonymousAuthenticationToken))
                .map(authentication -> {
                    if (authentication.getName() == null || authentication.getName().isBlank()) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid session identity");
                    }
                    UUID userId;
                    try {
                        userId = UUID.fromString(authentication.getName());
                    } catch (IllegalArgumentException exception) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid session identity");
                    }

                    String role = authentication.getAuthorities().stream()
                            .map(authority -> authority.getAuthority())
                            .filter(authority -> authority.startsWith("ROLE_"))
                            .map(authority -> authority.substring("ROLE_".length()))
                            .findFirst()
                            .orElse(null);
                    return new ProductActor(userId, role);
                });
    }

    public record ErrorResponse(String code, String message) {}

    public record StatusDTO(Boolean active) {}
}