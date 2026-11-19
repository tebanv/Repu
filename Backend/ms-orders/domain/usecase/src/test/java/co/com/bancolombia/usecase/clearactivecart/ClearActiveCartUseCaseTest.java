package co.com.bancolombia.usecase.clearactivecart;

import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;
import java.util.function.Supplier;

import static org.mockito.Mockito.*;

class ClearActiveCartUseCaseTest {
    @Test
    void delegatesClearToRepositoryInsideTransaction() {
        CartRepository carts = mock(CartRepository.class);
        UUID userId = UUID.randomUUID();
        when(carts.clearActive(userId)).thenReturn(Mono.empty());
        TransactionRunner transactions = new TransactionRunner() {
            @Override
            public <T> Mono<T> transactional(Supplier<Mono<T>> work) {
                return work.get();
            }
        };

        StepVerifier.create(new ClearActiveCartUseCase(carts, transactions).execute(userId))
                .verifyComplete();

        verify(carts).clearActive(userId);
    }
}
