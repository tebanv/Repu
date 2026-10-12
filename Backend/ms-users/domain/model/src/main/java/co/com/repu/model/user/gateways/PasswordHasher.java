package co.com.repu.model.user.gateways;

public interface PasswordHasher {
    String hash(String rawPassword);
}
