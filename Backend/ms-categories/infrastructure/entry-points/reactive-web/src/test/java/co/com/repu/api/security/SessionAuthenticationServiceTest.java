package co.com.repu.api.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SessionAuthenticationServiceTest {

    @Test
    void sessionEndpointPreservesAuthServiceBasePath() {
        assertEquals("http://ms-auth:8081/ms-auth/api/auth/session",
                SessionAuthenticationService.resolveSessionUri("http://ms-auth:8081/ms-auth").toString());
    }

    @Test
    void sessionEndpointPreservesBasePathWithTrailingSlash() {
        assertEquals("http://ms-auth:8081/ms-auth/api/auth/session",
                SessionAuthenticationService.resolveSessionUri("http://ms-auth:8081/ms-auth/").toString());
    }
}
