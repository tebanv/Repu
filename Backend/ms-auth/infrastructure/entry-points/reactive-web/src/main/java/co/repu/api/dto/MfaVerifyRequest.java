package co.repu.api.dto;

import lombok.Data;

@Data
public class MfaVerifyRequest {
    private String challengeId;
    private String code;
}
