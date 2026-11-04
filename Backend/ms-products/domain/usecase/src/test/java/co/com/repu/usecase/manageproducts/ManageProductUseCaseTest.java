package co.com.repu.usecase.manageproducts;

import co.com.repu.model.product.Product;
import co.com.repu.model.product.gateways.ProductRepository;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ManageProductUseCaseTest {

    @Test
    void shouldUpdateBrandWithoutChangingOtherProductData() {
        ProductRepository repository = mock(ProductRepository.class);
        Product existing = Product.builder()
                .id("product-id")
                .companyId("company-id")
                .categoryId("category-id")
                .name("Batería")
                .attributes(java.util.Map.of("brand", "Bosch"))
                .build();
        Product updated = existing.toBuilder().brand("Bosch").build();
        when(repository.findById("product-id")).thenReturn(Mono.just(existing));
        when(repository.save(any(Product.class), eq("request-id"))).thenReturn(Mono.just(updated));

        ManageProductUseCase useCase = new ManageProductUseCase(repository);
        Product updates = Product.builder().brand("Bosch").build();

        StepVerifier.create(useCase.updateProductDetails("product-id", updates, "request-id"))
                .expectNextMatches(product -> "Bosch".equals(product.getBrand())
                        && "Batería".equals(product.getName())
                        && product.getAttributes().equals(existing.getAttributes()))
                .verifyComplete();
    }
}
