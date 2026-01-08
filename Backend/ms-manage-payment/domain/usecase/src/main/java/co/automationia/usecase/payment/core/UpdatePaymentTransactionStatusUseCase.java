package co.automationia.usecase.payment.core;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class UpdatePaymentTransactionStatusUseCase {

    private final PaymentTransactionRepository paymentRepository;

    public Mono<PaymentTransaction> execute(Long id,
                                            String newStatus,
                                            String msg,
                                            String processorCode) {

        return paymentRepository.updateStatus(id, newStatus, msg, processorCode);
    }
}
