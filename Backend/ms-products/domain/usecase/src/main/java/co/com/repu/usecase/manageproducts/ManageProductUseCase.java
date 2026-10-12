package co.com.repu.usecase.manageproducts;

import lombok.RequiredArgsConstructor;

import co.com.repu.model.product.Product;
import co.com.repu.model.product.gateways.ProductRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageProductUseCase {

    private final ProductRepository productRepository;

    public Flux<Product> searchProducts(String companyId, String categoryId, String attributes) {
        // Validar que companyId venga (ya se valida en Handler, pero doble check no sobra)
        if (companyId == null) return Flux.error(new IllegalArgumentException("Company ID is required"));
        return productRepository.searchProducts(companyId, categoryId, attributes);
    }

    public Mono<Product> createProduct(Product product, String messageId) {
        product.setActive(true); // Activo por defecto
        return productRepository.save(product, messageId);
    }

    public Mono<Product> updateProductDetails(String productId, Product updates, String messageId) {
        return productRepository.findById(productId)
                .switchIfEmpty(Mono.error(new RuntimeException("Producto no encontrado")))
                .flatMap(existing -> {
                    Product merged = existing.toBuilder()
                            .name(updates.getName() != null ? updates.getName() : existing.getName())
                            .description(updates.getDescription() != null ? updates.getDescription() : existing.getDescription())
                            .price(updates.getPrice() != null ? updates.getPrice() : existing.getPrice())
                            .stock(updates.getStock() != null ? updates.getStock() : existing.getStock())
                            // Reemplazo total de atributos si vienen
                            .attributes(updates.getAttributes() != null ? updates.getAttributes() : existing.getAttributes())
                            .build();
                    return productRepository.save(merged, messageId);
                });
    }

    public Mono<Product> updateStatus(String productId, Boolean newStatus, String messageId) {
        return productRepository.findById(productId)
                .switchIfEmpty(Mono.error(new RuntimeException("Producto no encontrado")))
                .flatMap(existing -> {
                    if (existing.getActive().equals(newStatus)) return Mono.just(existing);
                    return productRepository.save(existing.toBuilder().active(newStatus).build(), messageId);
                });
    }
}
