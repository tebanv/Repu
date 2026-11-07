package co.com.repu.usecase.manageproducts;

import lombok.RequiredArgsConstructor;

import co.com.repu.model.product.ProductAccessDeniedException;
import co.com.repu.model.product.ProductActor;
import co.com.repu.model.product.ProductNotFoundException;
import co.com.repu.model.product.Product;
import co.com.repu.model.product.gateways.ProductRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class ManageProductUseCase {

    private final ProductRepository productRepository;

    public Flux<Product> searchProducts(String companyId, String categoryId, String attributes, ProductActor actor) {
        // Validar que companyId venga (ya se valida en Handler, pero doble check no sobra)
        if (companyId == null) return Flux.error(new IllegalArgumentException("Company ID is required"));
        if (actor != null && actor.isAdmin()) {
            return productRepository.searchProducts(companyId, categoryId, attributes, true);
        }
        if (actor != null && actor.isDistributor() && actor.userId() != null) {
            return productRepository.findCompanyOwnedBy(companyId, actor.userId().toString())
                    .hasElement()
                    .flatMapMany(isOwner -> productRepository.searchProducts(
                            companyId, categoryId, attributes, isOwner));
        }
        return productRepository.searchProducts(companyId, categoryId, attributes, false);
    }

    public Mono<Product> createProduct(Product product, ProductActor actor, String messageId) {
        if (product == null || product.getId() != null) {
            return Mono.error(new IllegalArgumentException("A new product cannot specify an ID"));
        }
        return requireProductManager(actor)
                .then(Mono.defer(() -> actor.isAdmin()
                        ? saveActiveProduct(product, messageId)
                        : productRepository.findActiveCompanyOwnedBy(product.getCompanyId(), actor.userId().toString())
                                .switchIfEmpty(Mono.error(new ProductAccessDeniedException()))
                                .flatMap(ownedCompanyId -> saveActiveProduct(
                                        product.toBuilder().companyId(ownedCompanyId).build(), messageId))));
    }

    public Mono<Product> updateProductDetails(String productId, Product updates, ProductActor actor, String messageId) {
        return findProductForManagement(productId, actor)
                .flatMap(existing -> {
                    Product merged = existing.toBuilder()
                            .name(updates.getName() != null ? updates.getName() : existing.getName())
                            .brand(updates.getBrand() != null ? updates.getBrand() : existing.getBrand())
                            .description(updates.getDescription() != null ? updates.getDescription() : existing.getDescription())
                            .price(updates.getPrice() != null ? updates.getPrice() : existing.getPrice())
                            .stock(updates.getStock() != null ? updates.getStock() : existing.getStock())
                            // Reemplazo total de atributos si vienen
                            .attributes(updates.getAttributes() != null ? updates.getAttributes() : existing.getAttributes())
                            .build();
                    return productRepository.save(merged, messageId)
                            .flatMap(saved -> updates.getActive() == null
                                    ? Mono.just(saved)
                                    : updateStatus(productId, updates.getActive(), actor, messageId));
                });
    }

    public Mono<Product> updateStatus(String productId, Boolean newStatus, ProductActor actor, String messageId) {
        if (newStatus == null) {
            return Mono.error(new IllegalArgumentException("Product status is required"));
        }
        return requireProductManager(actor)
                .then(Mono.defer(() -> actor.isAdmin()
                        ? productRepository.updateStatus(productId, newStatus)
                        : productRepository.updateStatusOwnedBy(
                                productId, newStatus, actor.userId().toString())))
                .switchIfEmpty(Mono.error(new ProductNotFoundException()));
    }

    private Mono<Product> saveActiveProduct(Product product, String messageId) {
        return productRepository.save(product.toBuilder().active(true).build(), messageId);
    }

    private Mono<Product> findProductForManagement(String productId, ProductActor actor) {
        return requireProductManager(actor)
                .then(Mono.defer(() -> actor.isAdmin()
                        ? productRepository.findById(productId)
                        : productRepository.findByIdOwnedBy(productId, actor.userId().toString())))
                .switchIfEmpty(Mono.error(new ProductNotFoundException()));
    }

    private Mono<Void> requireProductManager(ProductActor actor) {
        if (actor == null || !actor.canManageProducts()
                || (!actor.isAdmin() && actor.userId() == null)) {
            return Mono.error(new ProductAccessDeniedException());
        }
        return Mono.empty();
    }
}
