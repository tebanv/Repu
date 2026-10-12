package co.automationia.api.wompi;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

@Configuration
public class WompiRouterRest {

    private static final String BASE = "/wompi";

    @Bean
    public RouterFunction<ServerResponse> wompiRoutes(WompiHandler handler) {

        return RouterFunctions.route()
                .POST(BASE + "/tokenize", handler::tokenizeCard)
                .POST(BASE + "/payments", handler::create)
                .GET(BASE + "/payments/{wompiId}", handler::getWompiStatus)
                .build();
    }
}
