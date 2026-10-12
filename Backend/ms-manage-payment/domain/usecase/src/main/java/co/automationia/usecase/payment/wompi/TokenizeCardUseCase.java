package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.CardToken;
import co.automationia.model.payment.gateways.WompiRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class TokenizeCardUseCase {

    private final WompiRepository wompiRepository;

    public Mono<CardToken> execute(String number,
                                   String cvc,
                                   String expMonth,
                                   String expYear,
                                   String cardHolder) {

        return wompiRepository.tokenizeCard(number, cvc, expMonth, expYear, cardHolder);
    }
}
