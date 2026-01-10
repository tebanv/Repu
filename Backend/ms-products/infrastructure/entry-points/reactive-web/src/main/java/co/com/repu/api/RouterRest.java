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
        return route(GET("/api/catalog/products"), handler::searchProducts)
                .andRoute(POST("/api/catalog/products"), handler::createProduct)
                // Actualización de detalles (precio, stock, atributos)
                .andRoute(PATCH("/api/catalog/products/{productId}"), handler::updateProduct)
                // Actualización de estado (activo/inactivo) - Ruta específica
                .andRoute(PATCH("/api/catalog/products/{productId}/status"), handler::updateStatus);
    }
}
