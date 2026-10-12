package co.com.repu.model.category.gateways;

import co.com.repu.model.category.Category;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface CategoryRepository {
    Flux<Category> findAll();
    Mono<Category> findById(String id);
    Mono<Category> save(Category category, String messageId);
}
