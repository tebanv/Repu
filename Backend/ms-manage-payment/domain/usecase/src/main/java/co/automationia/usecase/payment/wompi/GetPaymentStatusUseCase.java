package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import co.automationia.model.payment.gateways.WompiRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class GetPaymentStatusUseCase {

    private final WompiRepository wompiRepository;
    private final PaymentTransactionRepository paymentRepository;

    public Mono<PaymentTransaction> execute(String wompiTransactionId) {

        return wompiRepository.getTransactionStatus(wompiTransactionId)
                .flatMap(status ->
                        paymentRepository.findByWompiTransactionId(wompiTransactionId)
                                .flatMap(existing ->
                                        paymentRepository.updateStatus(
                                                existing.getId(),
                                                status.getStatus(),
                                                status.getStatusMessage(),
                                                status.getProcessorResponseCode()
                                        )
                                )
                                .thenReturn(status)
                );
    }
}
