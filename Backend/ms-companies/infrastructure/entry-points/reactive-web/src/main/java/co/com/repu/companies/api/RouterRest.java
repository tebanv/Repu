package co.com.repu.companies.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.GET;
import static org.springframework.web.reactive.function.server.RequestPredicates.POST;
import static org.springframework.web.reactive.function.server.RequestPredicates.PATCH;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class RouterRest {

    @Bean
    public RouterFunction<ServerResponse> routerFunction(Handler handler) {
        return route(GET("/api/companies"), handler::getAllCompanies)
                .andRoute(POST("/api/companies"), handler::createCompany)
                .andRoute(PATCH("/api/companies/{companyId}/status"), handler::updateStatus)
                .andRoute(PATCH("/api/companies/{companyId}"), handler::updateCompanyDetails);
    }
}