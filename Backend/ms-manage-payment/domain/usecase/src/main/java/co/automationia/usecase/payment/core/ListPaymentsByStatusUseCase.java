package co.automationia.usecase.payment.core;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;

@RequiredArgsConstructor
public class ListPaymentsByStatusUseCase {

    private final PaymentTransactionRepository paymentRepository;

    public Flux<PaymentTransaction> execute(String status) {
        return paymentRepository.findByStatus(status);
    }
}