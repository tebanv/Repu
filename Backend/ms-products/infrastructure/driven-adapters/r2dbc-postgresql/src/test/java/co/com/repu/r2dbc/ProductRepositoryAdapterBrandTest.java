package co.com.repu.r2dbc;

import co.com.repu.model.product.Product;
import co.com.repu.r2dbc.entity.ProductEntity;
import co.com.repu.r2dbc.mapper.ProductMapper;
import co.com.repu.r2dbc.repository.ProductReactiveRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProductRepositoryAdapterBrandTest {

    @Test
    void shouldPersistAndReturnBrandWhenUpdatingProduct() {
        ProductReactiveRepository repository = mock(ProductReactiveRepository.class);
        ProductRepositoryAdapter adapter = new ProductRepositoryAdapter(
                repository,
                mock(DatabaseClient.class),
                new ProductMapper(new ObjectMapper())
        );
        UUID productId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        when(repository.save(any(ProductEntity.class))).thenAnswer(invocation -> {
            ProductEntity entity = invocation.getArgument(0);
            assertEquals("Bosch", entity.getBrand());
            return Mono.just(entity);
        });

        Product update = Product.builder()
                .id(productId.toString())
                .companyId(companyId.toString())
                .categoryId(categoryId.toString())
                .brand("Bosch")
                .build();

        StepVerifier.create(adapter.save(update, "request-id"))
                .assertNext(saved -> assertEquals("Bosch", saved.getBrand()))
                .verifyComplete();
    }
}
