package co.repu.usecase.auth;

import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.InvalidCredentialsException;
import co.repu.model.users.LoginResult;
import co.repu.model.users.User;
import co.repu.model.users.gateways.EmailMfaGateway;
import co.repu.model.users.gateways.LoginProtectionGateway;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.model.users.gateways.UsersRepository;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthUseCaseLoginTest {

    @Test
    void adminLoginStartsEmailChallengeAndDoesNotCreateSession() {
        UsersRepository users = mock(UsersRepository.class);
        UserSessionRepository sessions = mock(UserSessionRepository.class);
        LoginProtectionGateway protection = mock(LoginProtectionGateway.class);
        EmailMfaGateway mfa = mock(EmailMfaGateway.class);
        User admin = User.builder().id(UUID.randomUUID()).email("admin@repu.com")
                .password("hashed").role("ADMIN").status(true).build();
        when(protection.checkIpLimit("127.0.0.1")).thenReturn(Mono.empty());
        when(protection.checkAccountLock("admin@repu.com")).thenReturn(Mono.empty());
        when(protection.clearFailedAttempts("admin@repu.com")).thenReturn(Mono.empty());
        when(users.findByEmail("admin@repu.com")).thenReturn(Mono.just(admin));
        when(mockSecurityGateway().validatePassword("password", "hashed")).thenReturn(true);
        when(mfa.createAndSendChallenge(admin.getId(), admin.getEmail(), admin.getName()))
                .thenReturn(Mono.just("challenge-id"));
        AuthUseCase useCase = newUseCase(users, sessions, protection, mfa);

        StepVerifier.create(useCase.loginSession(
                        "admin@repu.com", "password", "request", "127.0.0.1", "agent", "device"))
                .assertNext(result -> {
                    assertTrue(result.isMfaRequired());
                    org.junit.jupiter.api.Assertions.assertEquals("challenge-id", result.getChallengeId());
                })
                .verifyComplete();

        verify(sessions, never()).save(any());
    }

    @Test
    void invalidPasswordRecordsFailureAndReturnsGenericCredentialsError() {
        UsersRepository users = mock(UsersRepository.class);
        LoginProtectionGateway protection = mock(LoginProtectionGateway.class);
        User buyer = User.builder().id(UUID.randomUUID()).email("buyer@repu.com")
                .password("hashed").role("COMPRADOR").status(true).build();
        when(protection.checkIpLimit("127.0.0.1")).thenReturn(Mono.empty());
        when(protection.checkAccountLock("buyer@repu.com")).thenReturn(Mono.empty());
        when(users.findByEmail("buyer@repu.com")).thenReturn(Mono.just(buyer));
        when(mockSecurityGateway().validatePassword("wrong", "hashed")).thenReturn(false);
        when(protection.recordFailedAttempt("buyer@repu.com")).thenReturn(Mono.empty());
        AuthUseCase useCase = newUseCase(
                users, mock(UserSessionRepository.class), protection, mock(EmailMfaGateway.class));

        StepVerifier.create(useCase.loginSession(
                        "buyer@repu.com", "wrong", "request", "127.0.0.1", "agent", "device"))
                .expectError(InvalidCredentialsException.class)
                .verify();

        verify(protection).recordFailedAttempt("buyer@repu.com");
    }

    private SecurityGateway mockSecurityGateway() {
        return securityGateway;
    }

    private final SecurityGateway securityGateway = mock(SecurityGateway.class);

    private AuthUseCase newUseCase(UsersRepository users, UserSessionRepository sessions,
                                   LoginProtectionGateway protection, EmailMfaGateway mfa) {
        return new AuthUseCase(
                users,
                securityGateway,
                sessions,
                mock(SystemParameterRepository.class),
                mock(SessionSecurityGateway.class),
                protection,
                mfa);
    }
}
