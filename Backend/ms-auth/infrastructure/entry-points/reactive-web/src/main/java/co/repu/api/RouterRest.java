package co.repu.api;

import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.GET;
import static org.springframework.web.reactive.function.server.RequestPredicates.PATCH;
import static org.springframework.web.reactive.function.server.RequestPredicates.POST;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
@Log4j2
public class RouterRest {

    @Bean
    public RouterFunction<ServerResponse> routerFunction(Handler handler) {
        return route(POST("/api/auth/login"), handler::listenLoginUseCase)
                .andRoute(POST("/api/auth/register"), handler::listenRegisterUseCase)
                .andRoute(POST("/api/auth/logout"), handler::listenLogoutUseCase)
                .andRoute(POST("/api/auth/logout-all"), handler::listenLogoutAllUseCase)
                .andRoute(GET("/api/auth/sessions"), handler::listenSessionsUseCase)
                .andRoute(GET("/api/users/profile"), handler::listenGetProfileUseCase)
                .andRoute(PATCH("/api/users/profile"), handler::listenUpdateProfileUseCase)
                .andRoute(GET("/api/system/parameters"), handler::listenGetSystemParametersUseCase)
                .andRoute(POST("/api/system/parameters"), handler::listenCreateSystemParameterUseCase)
                .andRoute(GET("/api/system/parameters/key/{key}"), handler::listenGetSystemParameterByKeyUseCase);
    }
}
