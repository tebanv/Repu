package co.com.repu.usecase.manageuser;

import co.com.repu.model.user.PasswordResetToken;
import co.com.repu.model.user.gateways.*;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@RequiredArgsConstructor
public class PasswordRecoveryUseCase {

    private static final int CODE_LENGTH = 6;
    private static final int EXPIRATION_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetRepository resetRepository;
    private final PasswordHasher passwordHasher;
    private final PasswordResetNotifier notifier;

    public Mono<Void> requestCode(String email) {
        if (email == null || email.isBlank()) {
            return Mono.error(new IllegalArgumentException("El correo electrónico es obligatorio."));
        }
        String normalizedEmail = email.trim().toLowerCase();
        return userRepository.findByEmail(normalizedEmail)
                .flatMap(user -> {
                    String code = generateCode();
                    return resetRepository.invalidateActiveTokens(user.getId())
                            .then(resetRepository.create(user.getId(), hash(code),
                                    EXPIRATION_MINUTES, MAX_ATTEMPTS))
                            .then(notifier.sendCode(user.getEmail(), user.getName(), code, EXPIRATION_MINUTES));
                })
                // No revelar si el correo existe o no.
                .then();
    }

    public Mono<Void> resetPassword(String email, String code, String newPassword) {
        validateInput(email, code, newPassword);
        return userRepository.findByEmail(email.trim().toLowerCase())
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Código inválido o expirado.")))
                .flatMap(user -> resetRepository.findValid(user.getId(), hash(code))
                        .switchIfEmpty(resetRepository.findActiveByUserId(user.getId())
                                .flatMap(token -> resetRepository.incrementFailedAttempts(token.getId())
                                        .then(Mono.error(new IllegalArgumentException(
                                                "Código inválido o expirado."))))))
                .flatMap(token -> resetRepository.updatePasswordAndInvalidateSessions(
                        token.getUserId(), passwordHasher.hash(newPassword), token.getId()));
    }

    public Mono<Void> registerFailedAttempt(String email, String code) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .flatMap(user -> resetRepository.findValid(user.getId(), hash(code)))
                .flatMap(token -> resetRepository.incrementFailedAttempts(token.getId()))
                .then();
    }

    private void validateInput(String email, String code, String password) {
        if (email == null || email.isBlank() || code == null || !code.matches("\\d{6}")) {
            throw new IllegalArgumentException("Correo y código de recuperación inválidos.");
        }
        if (password == null || password.length() < 8
                || password.chars().noneMatch(Character::isUpperCase)
                || password.chars().noneMatch(Character::isDigit)
                || password.chars().noneMatch(ch -> !Character.isLetterOrDigit(ch))) {
            throw new IllegalArgumentException(
                    "La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial.");
        }
    }

    private String generateCode() {
        return String.format("%0" + CODE_LENGTH + "d", RANDOM.nextInt(1_000_000));
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("No fue posible proteger el código de recuperación.", exception);
        }
    }
}
