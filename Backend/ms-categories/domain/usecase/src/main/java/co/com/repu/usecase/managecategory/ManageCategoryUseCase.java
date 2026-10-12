package co.com.repu.usecase.managecategory;

import co.com.repu.model.category.Category;
import co.com.repu.model.category.gateways.CategoryRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageCategoryUseCase {

    private final CategoryRepository categoryRepository;

    public Flux<Category> listCategories() {
        // Retorna la lista plana. El Frontend arma el árbol usando 'parentId'.
        return categoryRepository.findAll();
    }

    public Mono<Category> createCategory(Category category, String messageId) {
        category.setActive(true); // Activa por defecto

        // VALIDACIÓN DE PADRE (Integridad Referencial Lógica)
        if (category.getParentId() != null) {
            return categoryRepository.findById(category.getParentId())
                    .switchIfEmpty(Mono.error(new IllegalArgumentException("La categoría padre especificada no existe.")))
                    .flatMap(parent -> {
                        // Si el padre existe, procedemos a guardar la hija
                        return categoryRepository.save(category, messageId);
                    });
        }

        // Si es categoría raíz (parentId null), se guarda directo
        return categoryRepository.save(category, messageId);
    }
    public Mono<Category> updateCategory(String categoryId, Category updates, String messageId) {
        return categoryRepository.findById(categoryId)
                .switchIfEmpty(Mono.error(new RuntimeException("Categoría no encontrada.")))
                .flatMap(existing -> {

                    // A. MEZCLA DE DATOS (MERGE)
                    // Usamos el builder para sobreescribir solo lo que viene en 'updates'
                    Category.CategoryBuilder mergedBuilder = existing.toBuilder()
                            .name(updates.getName() != null ? updates.getName() : existing.getName())
                            .description(updates.getDescription() != null ? updates.getDescription() : existing.getDescription())
                            .iconUrl(updates.getIconUrl() != null ? updates.getIconUrl() : existing.getIconUrl())
                            .updatedAt(java.time.LocalDateTime.now());

                    // B. LÓGICA DE CAMBIO DE PADRE
                    String newParentId = updates.getParentId();

                    // Si están intentando cambiar el padre y es diferente al actual
                    if (newParentId != null && !newParentId.equals(existing.getParentId())) {
                        // Evitar que una categoría sea su propio padre (Ciclo básico)
                        if (newParentId.equals(categoryId)) {
                            return Mono.error(new IllegalArgumentException("Una categoría no puede ser su propio padre."));
                        }

                        // Verificar que el nuevo padre exista en la BD
                        return categoryRepository.findById(newParentId)
                                .switchIfEmpty(Mono.error(new IllegalArgumentException("La nueva categoría padre no existe.")))
                                .flatMap(parentExists -> {
                                    // Si existe, asignamos y guardamos
                                    mergedBuilder.parentId(newParentId);
                                    return categoryRepository.save(mergedBuilder.build(), messageId);
                                });
                    }

                    // Si no cambiaron el padre, mantenemos el anterior (o null si era raíz) y guardamos
                    // Nota: Si en el JSON mandan explícitamente null para borrar el padre, requeriría lógica extra.
                    // Aquí asumimos que null en updates significa "no actualizar este campo".

                    return categoryRepository.save(mergedBuilder.build(), messageId);
                });
    }


    public Mono<Category> updateStatus(String categoryId, Boolean newStatus, String messageId) {
        return categoryRepository.findById(categoryId)
                .switchIfEmpty(Mono.error(new RuntimeException("Categoría no encontrada.")))
                .flatMap(existing -> {
                    // Si el estado es igual, no hacemos nada
                    if (existing.getActive().equals(newStatus)) {
                        return Mono.just(existing);
                    }

                    // Actualizamos
                    Category updated = existing.toBuilder()
                            .active(newStatus)
                            .updatedAt(java.time.LocalDateTime.now())
                            .build();

                    return categoryRepository.save(updated, messageId);
                });
    }
}
