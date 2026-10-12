package co.com.repu.api;

import co.com.repu.model.product.Product;
import co.com.repu.usecase.manageproducts.ManageProductUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
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
            return ServerResponse.badRequest().bodyValue(new ErrorResponse("CompanyID válido es requerido."));
        }

        // 3. Decodificar JSON attributes (URL Encoded -> JSON String)
        String attributesJson = null;
        if (attributesEncoded != null) {
            try {
                attributesJson = URLDecoder.decode(attributesEncoded, StandardCharsets.UTF_8);
                // Opcional: Validar que sea un JSON válido usando Jackson aquí
            } catch (Exception e) {
                return ServerResponse.badRequest().bodyValue(new ErrorResponse("Formato de atributos JSON inválido."));
            }
        }

        log.info("Se recibe peticion para listar productos de empresaId: {}, categoria: {}, con filtros: {}, " +
                        "messsageId: {}",  companyId, categoryId, attributesJson, requestId);

        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(useCase.searchProducts(companyId, categoryId, attributesJson), Product.class)
                .doOnError(e -> log.error("[ReqID: {}] Error buscando productos", requestId, e));
    }

    /**
     * POST /catalog/products
     */
    public Mono<ServerResponse> createProduct(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.bodyToMono(Product.class)
                .flatMap(product -> {
                    if (product.getCompanyId() == null || product.getName() == null || product.getPrice() == null) {
                        // Lanzamos excepción para que caiga en onErrorResume
                        return Mono.error(new IllegalArgumentException("CompanyId, Name y Price son obligatorios."));
                    }
                    log.info("Se recibe solicitud para crear un producto: {}, messageId: {}", product.getName(), requestId);
                    return useCase.createProduct(product, requestId);
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
                    return useCase.updateProductDetails(productId, updates, requestId);
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
            return ServerResponse.badRequest().bodyValue(new ErrorResponse("ID de producto inválido"));
        }

        // Usamos un record local o StatusUpdateDTO global
        return request.bodyToMono(StatusDTO.class)
                .flatMap(dto -> {
                    if (dto.active() == null) {
                        return ServerResponse.badRequest().bodyValue(new ErrorResponse("El campo 'active' es requerido"));
                    }

                    log.info("[ReqID: {}] Cambiando estado de producto {} a {}", requestId, productId, dto.active());
                    return useCase.updateStatus(productId, dto.active(), requestId);
                })
                .flatMap(updated -> ServerResponse.ok().bodyValue(updated))
                .switchIfEmpty(ServerResponse.notFound().build())
                .onErrorResume(e -> handleError(e, requestId));
    }

    // --- Helpers y DTOs Internos ---

    private Mono<ServerResponse> handleError(Throwable e, String requestId) {
        log.error("[ReqID: {}] Error procesando solicitud: {}", requestId, e.getMessage());

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR; // 500 por defecto

        // Mapear excepciones a códigos HTTP
        if (e instanceof IllegalArgumentException || e.getMessage().contains("obligatorios")) {
            status = HttpStatus.BAD_REQUEST; // 400
        } else if (e.getMessage().contains("no encontrado")) {
            status = HttpStatus.NOT_FOUND;   // 404
        }

        return ServerResponse.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse(e.getMessage()));
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

    public record ErrorResponse(String error) {}

    public record StatusDTO(Boolean active) {}
}