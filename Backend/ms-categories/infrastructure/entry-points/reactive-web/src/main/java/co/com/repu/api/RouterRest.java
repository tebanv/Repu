package co.com.repu.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.*;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class RouterRest {
    @Bean
    public RouterFunction<ServerResponse> routerFunction(Handler handler) {
        return route(GET("/api/catalog/categories"), handler::listCategories)
                .andRoute(POST("/api/catalog/categories"), handler::createCategory)
                .andRoute(PATCH("/api/catalog/categories/{categoryId}"), handler::updateCategory)
                .andRoute(PATCH("/api/catalog/categories/{categoryId}/status"), handler::updateStatus);
    }
}
