package co.repu.config;

import co.repu.model.users.gateways.UsersRepository;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.usecase.auth.AuthUseCase;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

@Configuration
@ComponentScan(basePackages = "co.repu.usecase",
        includeFilters = {
                @ComponentScan.Filter(type = FilterType.REGEX, pattern = "^.+UseCase$")
        },
        useDefaultFilters = false)
public class UseCasesConfig {

        @Bean
        public AuthUseCase authUseCase(UsersRepository usersRepository,
                                       SecurityGateway securityGateway) {
                return new AuthUseCase(usersRepository, securityGateway);
        }
}
