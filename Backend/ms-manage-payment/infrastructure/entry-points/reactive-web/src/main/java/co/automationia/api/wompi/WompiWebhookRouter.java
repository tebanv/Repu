package co.automationia.api.wompi;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

@Configuration
public class WompiWebhookRouter {

    @Bean
    public RouterFunction<ServerResponse> wompiWebhookRoutes(WompiWebhookHandler handler) {
        return RouterFunctions.route()
                .POST("/wompi/webhook", handler::handle)
                .build();
    }
}
