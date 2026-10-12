package co.automationia.api.payment;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

@Configuration
public class PaymentRouterRest {

    private static final String BASE_PATH = "/payments";

    @Bean
    public RouterFunction<ServerResponse> paymentRoutes(PaymentHandler handler) {

        return RouterFunctions.route()
                .GET(BASE_PATH + "/id/{id}", handler::getById)
                .GET(BASE_PATH + "/reference/{reference}", handler::getByReference)
                .GET(BASE_PATH + "/status/{status}", handler::listByStatus)
                .PUT(BASE_PATH + "/{id}/status/{status}", handler::updateStatus)
                .build();
    }
}