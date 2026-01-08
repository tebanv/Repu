package co.delivery.model.clients.gateways;

import co.delivery.model.clients.Client;

public interface SecurityGateway {
    boolean validatePassword(String passwordPlain, String hashStoredPassword);
    String generateToken(Client client);
}
