package co.repu.r2dbc.mapper;

import co.repu.model.users.Session;
import co.repu.r2dbc.entity.SessionEntity;
import org.springframework.stereotype.Component;

@Component
public class SessionMapper {

    public Session toDomain(SessionEntity data) {
        if (data == null) {
            return null;
        }

        return Session.builder()
                .sessionId(data.getSessionId())
                .userId(data.getUserId())
                .tokenHash(data.getTokenHash())
                .activeCompanyId(data.getActiveCompanyId())
                .ipAddress(data.getIpAddress())
                .userAgent(data.getUserAgent())
                .deviceInfo(data.getDeviceInfo())
                .active(data.getActive())
                .expiresAt(data.getExpiresAt())
                .createdAt(data.getCreatedAt())
                .lastAccess(data.getLastAccess())
                .build();
    }

    public SessionEntity toEntity(Session domain) {
        if (domain == null) {
            return null;
        }

        return SessionEntity.builder()
                .sessionId(domain.getSessionId())
                .userId(domain.getUserId())
                .tokenHash(domain.getTokenHash())
                .activeCompanyId(domain.getActiveCompanyId())
                .ipAddress(domain.getIpAddress())
                .userAgent(domain.getUserAgent())
                .deviceInfo(domain.getDeviceInfo())
                .active(domain.getActive())
                .expiresAt(domain.getExpiresAt())
                .createdAt(domain.getCreatedAt())
                .lastAccess(domain.getLastAccess())
                .build();
    }
}
