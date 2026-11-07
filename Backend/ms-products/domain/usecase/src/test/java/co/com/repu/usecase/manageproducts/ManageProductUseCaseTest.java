package co.com.repu.usecase.manageproducts;

import co.com.repu.model.product.Product;
import co.com.repu.model.product.ProductAccessDeniedException;
import co.com.repu.model.product.ProductActor;
import co.com.repu.model.product.ProductNotFoundException;
import co.com.repu.model.product.gateways.ProductRepository;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ManageProductUseCaseTest {

    private static final UUID OWNER_ID = UUID.randomUUID();
    private static final ProductActor DISTRIBUTOR = new ProductActor(OWNER_ID, "DISTRIBUIDOR");
    private static final ProductActor BUYER = new ProductActor(UUID.randomUUID(), "COMPRADOR");

    @Test
    void shouldUpdateBrandForOwnedProductWithoutChangingOtherData() {
        ProductRepository repository = mock(ProductRepository.class);
        Product existing = Product.builder()
                .id("product-id")
                .companyId("company-id")
                .categoryId("category-id")
                .name("Batería")
                .attributes(java.util.Map.of("brand", "Bosch"))
                .build();
        Product updated = existing.toBuilder().brand("Bosch").build();
        when(repository.findByIdOwnedBy("product-id", OWNER_ID.toString())).thenReturn(Mono.just(existing));
        when(repository.save(any(Product.class), eq("request-id"))).thenReturn(Mono.just(updated));

        ManageProductUseCase useCase = new ManageProductUseCase(repository);
        Product updates = Product.builder().brand("Bosch").build();

        StepVerifier.create(useCase.updateProductDetails("product-id", updates, DISTRIBUTOR, "request-id"))
                .expectNextMatches(product -> "Bosch".equals(product.getBrand())
                        && "Batería".equals(product.getName())
                        && product.getAttributes().equals(existing.getAttributes()))
                .verifyComplete();
        verify(repository, never()).findById("product-id");
    }

    @Test
    void shouldNotUpdateProductOwnedByAnotherCompany() {
        ProductRepository repository = mock(ProductRepository.class);
        when(repository.findByIdOwnedBy("product-id", OWNER_ID.toString())).thenReturn(Mono.empty());

        StepVerifier.create(new ManageProductUseCase(repository).updateProductDetails(
                        "product-id", Product.builder().price(java.math.BigDecimal.ONE).build(),
                        DISTRIBUTOR, "request-id"))
                .expectError(ProductNotFoundException.class)
                .verify();

        verify(repository, never()).save(any(Product.class), any());
    }

    @Test
    void shouldUseCompanyValidatedAgainstOwnerForProductCreation() {
        ProductRepository repository = mock(ProductRepository.class);
        String companyIdFromDatabase = UUID.randomUUID().toString();
        Product requestProduct = Product.builder()
                .companyId(UUID.randomUUID().toString())
                .categoryId(UUID.randomUUID().toString())
                .name("Producto")
                .build();
        when(repository.findActiveCompanyOwnedBy(requestProduct.getCompanyId(), OWNER_ID.toString()))
                .thenReturn(Mono.just(companyIdFromDatabase));
        when(repository.save(any(Product.class), eq("request-id"))).thenAnswer(invocation ->
                Mono.just(invocation.getArgument(0)));

        StepVerifier.create(new ManageProductUseCase(repository)
                        .createProduct(requestProduct, DISTRIBUTOR, "request-id"))
                .expectNextMatches(saved -> companyIdFromDatabase.equals(saved.getCompanyId())
                        && Boolean.TRUE.equals(saved.getActive()))
                .verifyComplete();
    }

    @Test
    void shouldRejectCreationForCompanyNotOwnedByDistributor() {
        ProductRepository repository = mock(ProductRepository.class);
        Product product = Product.builder().companyId(UUID.randomUUID().toString()).build();
        when(repository.findActiveCompanyOwnedBy(product.getCompanyId(), OWNER_ID.toString()))
                .thenReturn(Mono.empty());

        StepVerifier.create(new ManageProductUseCase(repository).createProduct(product, DISTRIBUTOR, "request-id"))
                .expectError(ProductAccessDeniedException.class)
                .verify();

        verify(repository, never()).save(any(Product.class), any());
    }

    @Test
    void shouldRejectProductIdInCreateRequest() {
        ProductRepository repository = mock(ProductRepository.class);
        Product product = Product.builder()
                .id(UUID.randomUUID().toString())
                .companyId(UUID.randomUUID().toString())
                .categoryId(UUID.randomUUID().toString())
                .name("Producto")
                .build();

        StepVerifier.create(new ManageProductUseCase(repository).createProduct(product, DISTRIBUTOR, "request-id"))
                .expectError(IllegalArgumentException.class)
                .verify();

        verify(repository, never()).findActiveCompanyOwnedBy(any(), any());
        verify(repository, never()).save(any(Product.class), any());
    }

    @Test
    void shouldRejectBuyerEvenIfUseCaseIsCalledDirectly() {
        ProductRepository repository = mock(ProductRepository.class);

        StepVerifier.create(new ManageProductUseCase(repository).updateStatus(
                        "product-id", false, BUYER, "request-id"))
                .expectError(ProductAccessDeniedException.class)
                .verify();

        verify(repository, never()).findById(any());
        verify(repository, never()).findByIdOwnedBy(any(), any());
        verify(repository, never()).updateStatus(any(), anyBoolean());
        verify(repository, never()).updateStatusOwnedBy(any(), anyBoolean(), any());
    }

    @Test
    void shouldPersistInactiveStatusForDistributorOwnedProduct() {
        ProductRepository repository = mock(ProductRepository.class);
        Product updated = Product.builder()
                .id("product-id")
                .companyId(UUID.randomUUID().toString())
                .active(false)
                .build();
        when(repository.updateStatusOwnedBy("product-id", false, OWNER_ID.toString()))
                .thenReturn(Mono.just(updated));

        StepVerifier.create(new ManageProductUseCase(repository)
                        .updateStatus("product-id", false, DISTRIBUTOR, "request-id"))
                .expectNextMatches(product -> Boolean.FALSE.equals(product.getActive()))
                .verifyComplete();

        verify(repository, never()).save(any(Product.class), any());
    }

    @Test
    void shouldPersistStatusForAdminWithoutOwnerScope() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductActor admin = new ProductActor(UUID.randomUUID(), "ADMIN");
        Product updated = Product.builder().id("product-id").active(false).build();
        when(repository.updateStatus("product-id", false)).thenReturn(Mono.just(updated));

        StepVerifier.create(new ManageProductUseCase(repository)
                        .updateStatus("product-id", false, admin, "request-id"))
                .expectNextMatches(product -> Boolean.FALSE.equals(product.getActive()))
                .verifyComplete();

        verify(repository, never()).updateStatusOwnedBy(any(), anyBoolean(), any());
    }

    @Test
    void shouldUpdateStatusThroughProductPatchEndpoint() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductActor admin = new ProductActor(UUID.randomUUID(), "ADMIN");
        Product existing = Product.builder().id("product-id").active(true).build();
        Product updated = existing.toBuilder().active(false).build();
        when(repository.findById("product-id")).thenReturn(Mono.just(existing));
        when(repository.save(any(Product.class), eq("request-id"))).thenReturn(Mono.just(existing));
        when(repository.updateStatus("product-id", false)).thenReturn(Mono.just(updated));

        StepVerifier.create(new ManageProductUseCase(repository).updateProductDetails(
                        "product-id", Product.builder().active(false).build(), admin, "request-id"))
                .expectNextMatches(product -> Boolean.FALSE.equals(product.getActive()))
                .verifyComplete();

        verify(repository).updateStatus("product-id", false);
    }

    @Test
    void shouldRejectMissingActorBeforeAccessingRepository() {
        ProductRepository repository = mock(ProductRepository.class);

        StepVerifier.create(new ManageProductUseCase(repository).updateProductDetails(
                        "product-id", Product.builder().price(java.math.BigDecimal.ONE).build(),
                        null, "request-id"))
                .expectError(ProductAccessDeniedException.class)
                .verify();

        verify(repository, never()).findById(any());
        verify(repository, never()).findByIdOwnedBy(any(), any());
    }

    @Test
    void shouldShowInactiveProductsOnlyToOwnerOrAdmin() {
        ProductRepository repository = mock(ProductRepository.class);
        String companyId = UUID.randomUUID().toString();
        UUID otherDistributorId = UUID.randomUUID();
        when(repository.findCompanyOwnedBy(companyId, OWNER_ID.toString())).thenReturn(Mono.just(companyId));
        when(repository.findCompanyOwnedBy(companyId, otherDistributorId.toString())).thenReturn(Mono.empty());
        when(repository.searchProducts(companyId, null, null, true)).thenReturn(reactor.core.publisher.Flux.empty());
        when(repository.searchProducts(companyId, null, null, false)).thenReturn(reactor.core.publisher.Flux.empty());
        ManageProductUseCase useCase = new ManageProductUseCase(repository);

        StepVerifier.create(useCase.searchProducts(companyId, null, null, DISTRIBUTOR))
                .verifyComplete();
        StepVerifier.create(useCase.searchProducts(companyId, null, null,
                        new ProductActor(otherDistributorId, "DISTRIBUIDOR")))
                .verifyComplete();
        StepVerifier.create(useCase.searchProducts(companyId, null, null,
                        new ProductActor(UUID.randomUUID(), "COMPRADOR")))
                .verifyComplete();
        StepVerifier.create(useCase.searchProducts(companyId, null, null,
                        new ProductActor(UUID.randomUUID(), "ADMIN")))
                .verifyComplete();

        verify(repository, times(2)).searchProducts(companyId, null, null, true);
        verify(repository, times(2)).searchProducts(companyId, null, null, false);
    }
}
