package co.repu.model.users;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoginResult {
    boolean mfaRequired;
    String challengeId;
    AuthSession authSession;

    public static LoginResult authenticated(AuthSession authSession) {
        return LoginResult.builder().mfaRequired(false).authSession(authSession).build();
    }

    public static LoginResult challenge(String challengeId) {
        return LoginResult.builder().mfaRequired(true).challengeId(challengeId).build();
    }
}
