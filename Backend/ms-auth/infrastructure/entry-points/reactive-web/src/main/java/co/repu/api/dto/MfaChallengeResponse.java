package co.repu.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MfaChallengeResponse {
    boolean mfaRequired;
    String challengeId;
    long expiresInSeconds;
}
