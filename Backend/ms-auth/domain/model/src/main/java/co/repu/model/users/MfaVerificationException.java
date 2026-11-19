package co.repu.model.users;

public class MfaVerificationException extends RuntimeException {
    private final boolean attemptsExhausted;

    public MfaVerificationException(boolean attemptsExhausted) {
        super("Código inválido o expirado");
        this.attemptsExhausted = attemptsExhausted;
    }

    public boolean isAttemptsExhausted() {
        return attemptsExhausted;
    }
}
