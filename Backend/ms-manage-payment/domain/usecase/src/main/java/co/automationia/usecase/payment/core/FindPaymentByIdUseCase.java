package co.automationia.usecase.payment.core;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class FindPaymentByIdUseCase {

    private final PaymentTransactionRepository paymentRepository;

    public Mono<PaymentTransaction> execute(Long id) {
        return paymentRepository.findById(id);
    }
}
