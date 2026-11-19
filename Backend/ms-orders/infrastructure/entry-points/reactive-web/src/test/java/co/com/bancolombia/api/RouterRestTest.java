package co.com.bancolombia.api;

import co.com.bancolombia.usecase.acceptorder.AcceptOrderUseCase;
import co.com.bancolombia.usecase.additemtocart.AddItemToCartUseCase;
import co.com.bancolombia.usecase.cancelorder.CancelOrderUseCase;
import co.com.bancolombia.usecase.checkoutorder.CheckoutOrderUseCase;
import co.com.bancolombia.usecase.clearactivecart.ClearActiveCartUseCase;
import co.com.bancolombia.usecase.getactivecart.GetActiveCartUseCase;
import co.com.bancolombia.usecase.getactiveorders.GetActiveOrdersUseCase;
import co.com.bancolombia.usecase.getcurrentlocation.GetCurrentLocationUseCase;
import co.com.bancolombia.usecase.getorderdetails.GetOrderDetailsUseCase;
import co.com.bancolombia.usecase.listorders.ListOrdersUseCase;
import co.com.bancolombia.usecase.markorderready.MarkOrderReadyUseCase;
import co.com.bancolombia.usecase.rejectorder.RejectOrderUseCase;
import co.com.bancolombia.usecase.removeitemfromcart.RemoveItemFromCartUseCase;
import co.com.bancolombia.usecase.subscribetoorderlivestream.SubscribeToOrderLiveStreamUseCase;
import co.com.bancolombia.usecase.setcartitemquantity.SetCartItemQuantityUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webflux.test.autoconfigure.WebFluxTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.reactive.server.WebTestClient;

@ContextConfiguration(classes = {RouterRest.class, Handler.class})
@WebFluxTest
@Import(ApiErrorWebExceptionHandler.class)
@MockitoBean(types = {
        GetActiveCartUseCase.class, AddItemToCartUseCase.class, RemoveItemFromCartUseCase.class,
        SetCartItemQuantityUseCase.class, ClearActiveCartUseCase.class,
        CheckoutOrderUseCase.class, ListOrdersUseCase.class, GetActiveOrdersUseCase.class,
        GetOrderDetailsUseCase.class, CancelOrderUseCase.class, AcceptOrderUseCase.class,
        RejectOrderUseCase.class, MarkOrderReadyUseCase.class, SubscribeToOrderLiveStreamUseCase.class,
        GetCurrentLocationUseCase.class
})
class RouterRestTest {
    @Autowired
    private WebTestClient webTestClient;

    @Test
    void cartRequiresAuthentication() {
        webTestClient.get()
                .uri("/api/cart")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.code").isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void cartCanBeClearedWithoutRequestBody() {
        webTestClient.delete()
                .uri("/api/cart")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void activeOrdersRequireAuthentication() {
        webTestClient.get()
                .uri("/orders/active")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.code").isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void checkoutRequiresRequestId() {
        webTestClient.post()
                .uri("/api/orders/checkout")
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.code").isEqualTo("INVALID_REQUEST");
    }
}
