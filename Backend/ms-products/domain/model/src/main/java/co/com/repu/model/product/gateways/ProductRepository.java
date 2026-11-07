package co.com.repu.model.product.gateways;

import co.com.repu.model.product.Product;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ProductRepository {
    Mono<Product> save(Product product, String messageId);
    Mono<Product> findById(String id);
    Mono<Product> findByIdOwnedBy(String id, String ownerUserId);
    Mono<String> findActiveCompanyOwnedBy(String companyId, String ownerUserId);
    Mono<String> findCompanyOwnedBy(String companyId, String ownerUserId);
    Mono<Product> updateStatus(String id, boolean active);
    Mono<Product> updateStatusOwnedBy(String id, boolean active, String ownerUserId);
    Flux<Product> searchProducts(String companyId, String categoryId, String attributesJsonStr,
                                 boolean includeInactive);
}
