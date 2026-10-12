package co.com.repu.api;

import co.com.repu.model.category.Category;
import co.com.repu.usecase.managecategory.ManageCategoryUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class Handler {

    private final ManageCategoryUseCase useCase;

    private static final String HEADER_REQUEST_ID = "X-Request-ID";
    // Regex para validar UUIDs
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F-]{36}$");

    /**
     * GET /catalog/categories
     * Lista categorías (plana o árbol según lógica del caso de uso).
     */
    public Mono<ServerResponse> listCategories(ServerRequest request) {
        String requestId = getRequestId(request);

        // Opcional: Podrías recibir un query param ?tree=true si quisieras diferenciar
        log.info("[ReqID: {}] Listando catálogo de categorías", requestId);

        return ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(useCase.listCategories(), Category.class)
                .doOnError(e -> log.error("[ReqID: {}] Error listando categorías", requestId, e));
    }

    /**
     * POST /catalog/categories
     * Crea una nueva categoría.
     */
    public Mono<ServerResponse> createCategory(ServerRequest request) {
        String requestId = getRequestId(request);

        return request.bodyToMono(Category.class)
                .flatMap(category -> {
                    // Validaciones de entrada
                    if (category.getName() == null || category.getName().isBlank()) {
                        return Mono.error(new IllegalArgumentException("El nombre de la categoría es obligatorio."));
                    }
                    // Validar parentId si viene (debe ser UUID válido)
                    if (category.getParentId() != null && !UUID_PATTERN.matcher(category.getParentId()).matches()) {
                        return Mono.error(new IllegalArgumentException("El ID de la categoría padre no es válido."));
                    }

                    log.info("Se recibe peticion para crear categoría: {}, messageId: {}", category, requestId);
                    return useCase.createCategory(category, requestId);
                })
                .flatMap(created -> ServerResponse
                        .created(URI.create("/api/catalog/categories/" + created.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(created))
                .onErrorResume(e -> handleError(e, requestId));
    }

    /**
     * PATCH /catalog/categories/{categoryId}
     * Actualiza datos básicos (Nombre, Icono, Padre, Descripción).
     */
    public Mono<ServerResponse> updateCategory(ServerRequest request) {
        String messageId = getRequestId(request);
        String categoryId = request.pathVariable("categoryId");

        // 1. Validar formato UUID del ID de la URL
        if (!UUID_PATTERN.matcher(categoryId).matches()) {
            return ServerResponse.badRequest()
                    .bodyValue(new ErrorResponse("ID de categoría inválido en la URL."));
        }

        return request.bodyToMono(Category.class)
                .flatMap(updates -> {
                    // 2. Validar que si envían parentId, sea un UUID válido
                    if (updates.getParentId() != null && !UUID_PATTERN.matcher(updates.getParentId()).matches()) {
                        return Mono.error(new IllegalArgumentException("El ID de la categoría padre no tiene un formato válido."));
                    }

                    log.info("Se recibe peticion para Actualizar categoría ID: {}, messageId: {}", categoryId, messageId);
                    return useCase.updateCategory(categoryId, updates, messageId);
                })
                .flatMap(updatedCategory -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(updatedCategory))
                // 3. Manejo de 404 si la categoría no existe
                .switchIfEmpty(ServerResponse.notFound().build())
                .onErrorResume(e -> handleError(e, messageId));
    }

    /**
     * PATCH /catalog/categories/{categoryId}/status
     * Actualiza estado (Activo/Inactivo).
     */
    public Mono<ServerResponse> updateStatus(ServerRequest request) {
        String messageId = getRequestId(request);
        String categoryId = request.pathVariable("categoryId");

        if (!UUID_PATTERN.matcher(categoryId).matches()) {
            return ServerResponse.badRequest().bodyValue(new ErrorResponse("ID de categoría inválido"));
        }

        return request.bodyToMono(StatusDTO.class)
                .flatMap(dto -> {
                    if (dto.active() == null) {
                        return Mono.error(new IllegalArgumentException("El campo 'active' es requerido."));
                    }

                    log.info("[ReqID: {}] Cambiando estado de categoría {} a {}", messageId, categoryId, dto.active());
                    return useCase.updateStatus(categoryId, dto.active(), messageId);
                })
                .flatMap(updated -> ServerResponse.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(updated))
                .switchIfEmpty(ServerResponse.notFound().build())
                .onErrorResume(e -> handleError(e, messageId));
    }

    // --- Helpers ---

    private String getRequestId(ServerRequest request) {
        return request.headers().header(HEADER_REQUEST_ID).stream().findFirst().orElse("UNKNOWN");
    }

    private Mono<ServerResponse> handleError(Throwable e, String requestId) {
        log.error("Error procesando solicitud: {}, messageId: {}", e.getMessage(), requestId);

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;

        if (e instanceof IllegalArgumentException || e.getMessage().contains("obligatorio") || e.getMessage().contains("válido")) {
            status = HttpStatus.BAD_REQUEST;
        } else if (e.getMessage().contains("no encontrada")) {
            status = HttpStatus.NOT_FOUND;
        }

        return ServerResponse.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new ErrorResponse(e.getMessage()));
    }

    // DTOs Internos
    public record StatusDTO(Boolean active) {}
    public record ErrorResponse(String error) {}
}
