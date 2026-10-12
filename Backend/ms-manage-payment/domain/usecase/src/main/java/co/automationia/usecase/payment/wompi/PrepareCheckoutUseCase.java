package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.checkout.PrepareCheckoutRequest;
import co.automationia.model.payment.checkout.PrepareCheckoutResponse;
import co.automationia.model.payment.gateways.IntegritySignatureGateway;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
public class PrepareCheckoutUseCase {

    private final PaymentTransactionRepository paymentRepository;
    private final IntegritySignatureGateway signatureGateway;
    private final String publicKey;

    public Mono<PrepareCheckoutResponse> execute(PrepareCheckoutRequest request) {

        if (request == null) {
            return Mono.error(new IllegalArgumentException("La solicitud de checkout no puede ser nula"));
        }

        String reference = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();

        return signatureGateway.generate(
                        reference,
                        request.getAmountInCents(),
                        request.getCurrency(),
                        request.getExpirationTime()
                )
                .flatMap(signature -> {

                    PaymentTransaction transaction = PaymentTransaction.builder()
                            .reference(reference)
                            .paymentType("CHECKOUT")
                            .paymentMethodType("CHECKOUT")
                            .entityId(request.getEntityId())
                            .companyId(request.getCompanyId())
                            .amountInCents(request.getAmountInCents())
                            .currency(request.getCurrency())
                            .customerEmail(request.getCustomerEmail())
                            .status("PENDING")
                            .createdAt(now)
                            .updatedAt(now)
                            .build();

                    return paymentRepository.save(transaction)
                            .thenReturn(
                                    PrepareCheckoutResponse.builder()
                                            .publicKey(publicKey)
                                            .reference(reference)
                                            .amountInCents(request.getAmountInCents())
                                            .currency(request.getCurrency())
                                            .signature(signature)
                                            .redirectUrl(request.getRedirectUrl())
                                            .expirationTime(request.getExpirationTime())
                                            .build()
                            );
                });
    }
}