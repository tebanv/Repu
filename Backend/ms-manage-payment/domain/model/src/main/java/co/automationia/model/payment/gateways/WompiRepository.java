package co.automationia.model.payment.gateways;

import co.automationia.model.payment.CardToken;
import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.WompiAcceptance;
import reactor.core.publisher.Mono;

public interface WompiRepository {

    Mono<CardToken> tokenizeCard(String number,
                                 String cvc,
                                 String expMonth,
                                 String expYear,
                                 String cardHolder);

    Mono<PaymentTransaction> createTransaction(PaymentTransaction tx,
                                               String acceptanceToken);

    Mono<PaymentTransaction> getTransactionStatus(String wompiTransactionId);

    Mono<WompiAcceptance> getAcceptanceToken();

}