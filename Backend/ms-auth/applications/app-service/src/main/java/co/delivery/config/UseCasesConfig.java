package co.delivery.config;

import co.delivery.model.clients.gateways.ClientsRepository;
import co.delivery.model.clients.gateways.SecurityGateway;
import co.delivery.usecase.auth.AuthUseCase;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

@Configuration
@ComponentScan(basePackages = "co.delivery.usecase",
        includeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "^.+UseCase$")
        },
        useDefaultFilters = false)
public class UseCasesConfig {

        @Bean
        public AuthUseCase authUseCase(ClientsRepository clientsRepository,
                                       SecurityGateway securityGateway) {
                return new AuthUseCase(clientsRepository, securityGateway);
        }
}
