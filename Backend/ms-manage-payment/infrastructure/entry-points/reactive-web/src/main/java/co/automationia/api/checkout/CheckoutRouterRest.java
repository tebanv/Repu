package co.automationia.api.checkout;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

@Configuration
public class CheckoutRouterRest {

    private static final String BASE = "/wompi/checkout";

    @Bean
    public RouterFunction<ServerResponse> checkoutRoutes(CheckoutHandler handler) {
        return RouterFunctions.route()
                .POST(BASE + "/prepare", handler::prepare)
                .build();
    }
}
