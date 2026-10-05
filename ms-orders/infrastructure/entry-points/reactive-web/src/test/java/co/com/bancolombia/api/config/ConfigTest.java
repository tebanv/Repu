package co.com.bancolombia.api.config;

import co.com.bancolombia.api.Handler;
import co.com.bancolombia.api.RouterRest;
import co.com.bancolombia.api.ApiErrorWebExceptionHandler;
import co.com.bancolombia.usecase.acceptorder.AcceptOrderUseCase;
import co.com.bancolombia.usecase.additemtocart.AddItemToCartUseCase;
import co.com.bancolombia.usecase.cancelorder.CancelOrderUseCase;
import co.com.bancolombia.usecase.checkoutorder.CheckoutOrderUseCase;
import co.com.bancolombia.usecase.getactivecart.GetActiveCartUseCase;
import co.com.bancolombia.usecase.getactiveorders.GetActiveOrdersUseCase;
import co.com.bancolombia.usecase.getcurrentlocation.GetCurrentLocationUseCase;
import co.com.bancolombia.usecase.getorderdetails.GetOrderDetailsUseCase;
import co.com.bancolombia.usecase.listorders.ListOrdersUseCase;
import co.com.bancolombia.usecase.markorderready.MarkOrderReadyUseCase;
import co.com.bancolombia.usecase.rejectorder.RejectOrderUseCase;
import co.com.bancolombia.usecase.removeitemfromcart.RemoveItemFromCartUseCase;
import co.com.bancolombia.usecase.subscribetoorderlivestream.SubscribeToOrderLiveStreamUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webflux.test.autoconfigure.WebFluxTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.reactive.server.WebTestClient;

@ContextConfiguration(classes = {RouterRest.class, Handler.class})
@WebFluxTest
@Import({CorsConfig.class, SecurityHeadersConfig.class, ApiErrorWebExceptionHandler.class})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost")
@MockitoBean(types = {
        GetActiveCartUseCase.class, AddItemToCartUseCase.class, RemoveItemFromCartUseCase.class,
        CheckoutOrderUseCase.class, ListOrdersUseCase.class, GetActiveOrdersUseCase.class,
        GetOrderDetailsUseCase.class, CancelOrderUseCase.class, AcceptOrderUseCase.class,
        RejectOrderUseCase.class, MarkOrderReadyUseCase.class, SubscribeToOrderLiveStreamUseCase.class,
        GetCurrentLocationUseCase.class
})
class ConfigTest {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void corsConfigurationShouldAllowOrigins() {
        webTestClient.get()
                .uri("/cart?companyId=8f5a3b21-6543-41c2-b987-123456789abc")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals("Content-Security-Policy",
                        "default-src 'self'; frame-ancestors 'self'; form-action 'self'")
                .expectHeader().valueEquals("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
                .expectHeader().valueEquals("X-Content-Type-Options", "nosniff")
                .expectHeader().doesNotExist("Server")
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectHeader().valueEquals("Pragma", "no-cache")
                .expectHeader().valueEquals("Referrer-Policy", "strict-origin-when-cross-origin");
    }

}