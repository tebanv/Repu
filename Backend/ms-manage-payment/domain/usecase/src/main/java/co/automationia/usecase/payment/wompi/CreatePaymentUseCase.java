package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import co.automationia.model.payment.gateways.WompiRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class CreatePaymentUseCase {

    private final WompiRepository wompiRepository;
    private final PaymentTransactionRepository paymentRepository;

    public Mono<PaymentTransaction> execute(PaymentTransaction tx, String acceptanceToken) {

        // Ensure tipo_pago (paymentType) is always set
        PaymentTransaction prepared = tx.toBuilder()
                .paymentType(tx.getPaymentMethodType())
                .build();

        return wompiRepository.createTransaction(prepared, acceptanceToken)
                .flatMap(created -> {

                    PaymentTransaction updated = prepared.toBuilder()
                            .wompiTransactionId(created.getWompiTransactionId())
                            .status(created.getStatus())
                            .statusMessage(created.getStatusMessage())
                            .processorResponseCode(created.getProcessorResponseCode())
                            .build();

                    return paymentRepository.save(updated);
                });
    }
}