package co.com.repu.model.product.gateways;

import co.com.repu.model.product.Product;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ProductRepository {
    Mono<Product> save(Product product, String messageId);
    Mono<Product> findById(String id);
    Flux<Product> searchProducts(String companyId, String categoryId, String attributesJsonStr);
}
