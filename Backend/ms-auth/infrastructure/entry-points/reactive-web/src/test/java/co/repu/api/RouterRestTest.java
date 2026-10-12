package co.repu.api;

import co.repu.api.config.SecurityConfig;
import co.repu.model.users.User;
import co.repu.model.users.AuthSession;
import co.repu.usecase.auth.AuthUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ContextConfiguration(classes = {RouterRest.class, Handler.class, SecurityConfig.class})
@WebFluxTest
class RouterRestTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private AuthUseCase authUseCase;

    @Test
    void testLoginEndpointReturnsToken() {
        when(authUseCase.loginSession(anyString(), anyString(), anyString(), any(), any(), any()))
                .thenReturn(Mono.just(AuthSession.builder()
                        .rawToken("opaque-token")
                        .expiresInSeconds(604800L)
                        .user(User.builder().id(java.util.UUID.randomUUID()).role("COMPRADOR").build())
                        .build()));

        webTestClient.post()
                .uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"email\":\"juan@repu.com\",\"password\":\"P@ssw0rd2026!\"}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.authenticated").isEqualTo(true)
                .jsonPath("$.accessToken").isEqualTo("opaque-token");
    }

    @Test
    void testRegisterEndpointReturnsCreatedUser() {
        when(authUseCase.register(org.mockito.ArgumentMatchers.any(User.class), anyString()))
                .thenReturn(Mono.just(User.builder().id(java.util.UUID.randomUUID()).email("juan@repu.com").name("Juan").role("COMPRADOR").status(true).build()));

        webTestClient.post()
                .uri("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"firstName\":\"Juan\",\"lastName\":\"Pérez\",\"email\":\"juan@repu.com\",\"password\":\"P@ssw0rd2026!\",\"role\":\"COMPRADOR\"}")
                .exchange()
                .expectStatus().isCreated();
    }
}
