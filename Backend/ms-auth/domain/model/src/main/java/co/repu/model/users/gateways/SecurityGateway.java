package co.repu.model.users.gateways;

import co.repu.model.users.User;

public interface SecurityGateway {
    String hashPassword(String password); // Para registrar
    boolean validatePassword(String passwordPlain, String hashStoredPassword); // Para login
    String generateToken(User user); // Para generar JWT
}
