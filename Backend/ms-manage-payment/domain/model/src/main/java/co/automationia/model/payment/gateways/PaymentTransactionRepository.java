package co.automationia.model.payment.gateways;

import co.automationia.model.payment.PaymentTransaction;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface PaymentTransactionRepository {

    Mono<PaymentTransaction> save(PaymentTransaction tx);

    Mono<PaymentTransaction> findById(Long id);

    Mono<PaymentTransaction> findByReference(String reference);

    Flux<PaymentTransaction> findByStatus(String status);

    Mono<PaymentTransaction> updateStatus(Long id, String status, String msg, String processorCode);

    Mono<PaymentTransaction> findByWompiTransactionId(String wompiId);
}
