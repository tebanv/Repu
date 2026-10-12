package co.com.repu.model.user.gateways;

import reactor.core.publisher.Mono;

public interface PasswordResetNotifier {
    Mono<Void> sendCode(String email, String firstName, String code, int expirationMinutes);
}
