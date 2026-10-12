package co.com.bancolombia.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.DELETE;
import static org.springframework.web.reactive.function.server.RequestPredicates.GET;
import static org.springframework.web.reactive.function.server.RequestPredicates.POST;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class RouterRest {
    @Bean
    public RouterFunction<ServerResponse> routerFunction(Handler handler) {
        return route(GET("/cart"), handler::getCart)
                .andRoute(POST("/cart/items"), handler::addCartItem)
                .andRoute(DELETE("/cart/items/{itemId}"), handler::removeCartItem)
                .andRoute(GET("/orders/active"), handler::activeOrders)
                .andRoute(GET("/orders"), handler::listOrders)
                .andRoute(POST("/orders/checkout"), handler::checkout)
                .andRoute(GET("/orders/{orderId}/live-stream"), handler::liveStream)
                .andRoute(POST("/orders/{orderId}/cancel"), handler::cancelOrder)
                .andRoute(GET("/orders/{orderId}"), handler::orderDetails)
                .andRoute(POST("/companies/{companyId}/orders/{orderId}/accept"), handler::acceptOrder)
                .andRoute(POST("/companies/{companyId}/orders/{orderId}/reject"), handler::rejectOrder)
                .andRoute(POST("/companies/{companyId}/orders/{orderId}/ready"), handler::markReady)
                .andRoute(GET("/tracking/order/{orderId}"), handler::trackingSnapshot);
    }
}
