package co.com.bancolombia.model.order.gateways;

import reactor.core.publisher.Mono;

import java.util.function.Supplier;

public interface TransactionRunner {
    <T> Mono<T> transactional(Supplier<Mono<T>> work);
}
