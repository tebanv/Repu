package co.automationia.usecase.payment.wompi;

import co.automationia.model.payment.WompiAcceptance;
import co.automationia.model.payment.gateways.WompiRepository;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

@RequiredArgsConstructor
public class GetAcceptanceTokenUseCase {

    private final WompiRepository wompiRepository;

    public Mono<WompiAcceptance> execute() {
        return wompiRepository.getAcceptanceToken();
    }
}
