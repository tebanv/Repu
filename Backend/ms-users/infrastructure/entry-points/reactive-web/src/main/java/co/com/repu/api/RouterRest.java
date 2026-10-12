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
        return route(GET("/api/users/profile"), handler::getMyProfile)
                .andRoute(POST("/api/users/password-recovery"), handler::requestPasswordRecovery)
                .andRoute(POST("/api/users/password-reset"), handler::resetPassword)
                .andRoute(PATCH("/api/users/profile"), handler::updateMyProfile)
                .andRoute(GET("/api/users/addresses"), handler::getAddresses)
                .andRoute(POST("/api/users/addresses"), handler::createAddress)
                .andRoute(PATCH("/api/users/addresses/{addressId}"), handler::updateAddress)
                .andRoute(DELETE("/api/users/addresses/{addressId}"), handler::deleteAddress)
                .andRoute(PATCH("/api/users/{userId}/status"), handler::changeUserStatus);
    }
}
