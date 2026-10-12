package co.automationia.config;

import co.automationia.model.payment.gateways.IntegritySignatureGateway;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import co.automationia.model.payment.gateways.WompiRepository;
import co.automationia.usecase.payment.core.FindPaymentByIdUseCase;
import co.automationia.usecase.payment.core.FindPaymentByReferenceUseCase;
import co.automationia.usecase.payment.core.ListPaymentsByStatusUseCase;
import co.automationia.usecase.payment.core.UpdatePaymentTransactionStatusUseCase;
import co.automationia.usecase.payment.wompi.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

@Configuration
@ComponentScan(basePackages = "co.automationia.usecase",
        includeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "^.+UseCase$")
        },
        useDefaultFilters = false)
public class UseCasesConfig {
    @Bean
    public TokenizeCardUseCase tokenizeCardUseCase(WompiRepository wompi) {
        return new TokenizeCardUseCase(wompi);
    }

    @Bean
    public CreatePaymentUseCase createPaymentUseCase(WompiRepository wompi,
                                                     PaymentTransactionRepository repo) {
        return new CreatePaymentUseCase(wompi, repo);
    }

    @Bean
    public GetPaymentStatusUseCase getPaymentStatusUseCase(WompiRepository wompi,
                                                           PaymentTransactionRepository repo) {
        return new GetPaymentStatusUseCase(wompi, repo);
    }

    @Bean
    public UpdatePaymentTransactionStatusUseCase updatePaymentTransactionStatusUseCase(
            PaymentTransactionRepository repo) {
        return new UpdatePaymentTransactionStatusUseCase(repo);
    }

    @Bean
    public FindPaymentByIdUseCase findPaymentByIdUseCase(PaymentTransactionRepository repo) {
        return new FindPaymentByIdUseCase(repo);
    }

    @Bean
    public FindPaymentByReferenceUseCase findPaymentByReferenceUseCase(
            PaymentTransactionRepository repo) {
        return new FindPaymentByReferenceUseCase(repo);
    }

    @Bean
    public ListPaymentsByStatusUseCase listPaymentsByStatusUseCase(
            PaymentTransactionRepository repo) {
        return new ListPaymentsByStatusUseCase(repo);
    }

    @Bean
    public GetAcceptanceTokenUseCase getAcceptanceTokenUseCase(WompiRepository wompiRepository) {
        return new GetAcceptanceTokenUseCase(wompiRepository);
    }

    @Value("${adapters.wompi.public-key}")
    private String publicKey;

    @Bean
    public PrepareCheckoutUseCase prepareCheckoutUseCase(
            PaymentTransactionRepository repo,
            IntegritySignatureGateway gate
    ) {
        return new PrepareCheckoutUseCase(repo, gate, publicKey);
    }

    @Bean
    public ProcessWompiWebhookUseCase processWompiWebhookUseCase(
            PaymentTransactionRepository paymentTransactionRepository
    ) {
        return new ProcessWompiWebhookUseCase(paymentTransactionRepository);
    }



}
