package co.com.bancolombia.usecase.setcartitemquantity;

import co.com.bancolombia.model.cart.Cart;
import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.OrderException;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class SetCartItemQuantityUseCaseTest {
    private final CartRepository carts = mock(CartRepository.class);
    private final TransactionRunner transactions = new TransactionRunner() {
        @Override
        public <T> Mono<T> transactional(Supplier<Mono<T>> work) {
            return work.get();
        }
    };
    private final SetCartItemQuantityUseCase useCase =
            new SetCartItemQuantityUseCase(carts, transactions);

    @Test
    void rejectsNegativeQuantityBeforePersistence() {
        StepVerifier.create(useCase.execute(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), -1))
                .expectErrorSatisfies(error -> {
                    OrderException exception = (OrderException) error;
                    assertEquals("INVALID_REQUEST", exception.code());
                    assertEquals(400, exception.status());
                })
                .verify();

        verifyNoInteractions(carts);
    }

    @Test
    void delegatesExactQuantityInsideTransaction() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Cart cart = new Cart(UUID.randomUUID(), companyId, List.of(), BigDecimal.ZERO, Instant.now());
        when(carts.setItemQuantity(userId, companyId, productId, 3)).thenReturn(Mono.just(cart));

        StepVerifier.create(useCase.execute(userId, companyId, productId, 3))
                .expectNext(cart)
                .verifyComplete();

        verify(carts).setItemQuantity(userId, companyId, productId, 3);
    }

    @Test
    void allowsZeroToRemoveAnItem() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        Cart cart = new Cart(UUID.randomUUID(), companyId, List.of(), BigDecimal.ZERO, Instant.now());
        when(carts.setItemQuantity(userId, companyId, productId, 0)).thenReturn(Mono.just(cart));

        StepVerifier.create(useCase.execute(userId, companyId, productId, 0))
                .expectNext(cart)
                .verifyComplete();

        verify(carts).setItemQuantity(userId, companyId, productId, 0);
    }
}
