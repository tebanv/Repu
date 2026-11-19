package co.repu.usecase.auth;

import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.Session;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.gateways.EmailMfaGateway;
import co.repu.model.users.gateways.LoginProtectionGateway;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.model.users.gateways.UsersRepository;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthUseCaseLogoutTest {

    @Test
    void shouldTreatUnknownOrInvalidTokenLogoutAsSuccessfulNoOp() {
        UserSessionRepository sessions = mock(UserSessionRepository.class);
        when(sessions.findByTokenHash(anyString())).thenReturn(Mono.empty());
        AuthUseCase useCase = newUseCase(sessions, mock(SessionSecurityGateway.class));

        StepVerifier.create(useCase.logoutByToken("invalid-or-expired-token"))
                .verifyComplete();

        verify(sessions, never()).deactivateBySessionId(any());
    }

    @Test
    void shouldRevokeSessionByPresentedToken() {
        UserSessionRepository sessions = mock(UserSessionRepository.class);
        SessionSecurityGateway cache = mock(SessionSecurityGateway.class);
        Session session = Session.builder()
                .sessionId(UUID.randomUUID())
                .active(true)
                .tokenHash("token-hash")
                .build();
        when(sessions.findByTokenHash(anyString())).thenReturn(Mono.just(session));
        when(sessions.deactivateBySessionId(session.getSessionId())).thenReturn(Mono.empty());
        when(cache.evict(session)).thenReturn(Mono.empty());
        AuthUseCase useCase = newUseCase(sessions, cache);

        StepVerifier.create(useCase.logoutByToken("presented-token"))
                .verifyComplete();

        verify(sessions).deactivateBySessionId(session.getSessionId());
        verify(cache).evict(session);
    }

    @Test
    void shouldNotRevokeInactiveSessionAgain() {
        UserSessionRepository sessions = mock(UserSessionRepository.class);
        Session session = Session.builder().sessionId(UUID.randomUUID()).active(false).build();
        when(sessions.findByTokenHash(anyString())).thenReturn(Mono.just(session));
        AuthUseCase useCase = newUseCase(sessions, mock(SessionSecurityGateway.class));

        StepVerifier.create(useCase.logoutByToken("presented-token"))
                .verifyComplete();

        verify(sessions, never()).deactivateBySessionId(any());
    }

    private AuthUseCase newUseCase(UserSessionRepository sessions, SessionSecurityGateway cache) {
        return new AuthUseCase(
                mock(UsersRepository.class),
                mock(SecurityGateway.class),
                sessions,
                mock(SystemParameterRepository.class),
                cache,
                mock(LoginProtectionGateway.class),
                mock(EmailMfaGateway.class));
    }
}
