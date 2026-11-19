package co.com.repu.r2dbc;

import co.com.repu.model.product.Product;
import co.com.repu.r2dbc.entity.ProductEntity;
import co.com.repu.r2dbc.mapper.ProductMapper;
import co.com.repu.r2dbc.repository.ProductReactiveRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.r2dbc.core.FetchSpec;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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

    @Test
    void shouldUpdateStatusWithOwnerConstraintAndReadBackPersistedValue() {
        ProductReactiveRepository repository = mock(ProductReactiveRepository.class);
        DatabaseClient databaseClient = mock(DatabaseClient.class);
        ProductRepositoryAdapter adapter = new ProductRepositoryAdapter(
                repository,
                databaseClient,
                new ProductMapper(new ObjectMapper())
        );
        DatabaseClient.GenericExecuteSpec executeSpec = mock(DatabaseClient.GenericExecuteSpec.class);
        FetchSpec<java.util.Map<String, Object>> fetchSpec = mock(FetchSpec.class);
        UUID productId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        ProductEntity persisted = ProductEntity.builder()
                .id(productId)
                .companyId(companyId)
                .categoryId(categoryId)
                .active(false)
                .build();
        when(databaseClient.sql(anyString())).thenReturn(executeSpec);
        when(executeSpec.bind(anyString(), any())).thenReturn(executeSpec);
        when(executeSpec.fetch()).thenReturn(fetchSpec);
        when(fetchSpec.rowsUpdated()).thenReturn(Mono.just(1L));
        when(repository.findByIdOwnedBy(productId, ownerId)).thenReturn(Mono.just(persisted));

        StepVerifier.create(adapter.updateStatusOwnedBy(
                        productId.toString(), false, ownerId.toString()))
                .assertNext(saved -> assertEquals(Boolean.FALSE, saved.getActive()))
                .verifyComplete();

        verify(databaseClient).sql(org.mockito.ArgumentMatchers.contains(
                "SET activo = :active"));
        verify(databaseClient).sql(org.mockito.ArgumentMatchers.contains("id_usuario_propietario"));
        verify(executeSpec).bind("active", false);
        verify(executeSpec).bind("ownerUserId", ownerId);
        verify(repository).findByIdOwnedBy(productId, ownerId);
    }

    @Test
    void shouldReturnEmptyIfOwnerScopedStatusUpdateDoesNotMatchAnyProduct() {
        ProductReactiveRepository repository = mock(ProductReactiveRepository.class);
        DatabaseClient databaseClient = mock(DatabaseClient.class);
        ProductRepositoryAdapter adapter = new ProductRepositoryAdapter(
                repository,
                databaseClient,
                new ProductMapper(new ObjectMapper())
        );
        DatabaseClient.GenericExecuteSpec executeSpec = mock(DatabaseClient.GenericExecuteSpec.class);
        FetchSpec<java.util.Map<String, Object>> fetchSpec = mock(FetchSpec.class);
        UUID productId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        when(databaseClient.sql(anyString())).thenReturn(executeSpec);
        when(executeSpec.bind(anyString(), any())).thenReturn(executeSpec);
        when(executeSpec.fetch()).thenReturn(fetchSpec);
        when(fetchSpec.rowsUpdated()).thenReturn(Mono.just(0L));

        StepVerifier.create(adapter.updateStatusOwnedBy(productId.toString(), false, ownerId.toString()))
                .verifyComplete();
        verify(repository, org.mockito.Mockito.never()).findByIdOwnedBy(any(), any());
    }
}
