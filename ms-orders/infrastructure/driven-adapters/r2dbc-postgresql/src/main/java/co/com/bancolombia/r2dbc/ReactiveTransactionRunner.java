package co.com.bancolombia.r2dbc;

import co.com.bancolombia.model.order.gateways.TransactionRunner;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.reactive.TransactionalOperator;
import reactor.core.publisher.Mono;

import java.util.function.Supplier;

@Repository
@RequiredArgsConstructor
public class ReactiveTransactionRunner implements TransactionRunner {
    private final TransactionalOperator operator;

    @Override
    public <T> Mono<T> transactional(Supplier<Mono<T>> work) {
        return Mono.defer(work).as(operator::transactional);
    }
}
