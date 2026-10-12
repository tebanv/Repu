package co.repu.config;

import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.model.users.gateways.UsersRepository;
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
                                       SecurityGateway securityGateway,
                                       UserSessionRepository userSessionRepository,
                                       SystemParameterRepository systemParameterRepository,
                                       SessionSecurityGateway sessionSecurityGateway) {
                return new AuthUseCase(usersRepository, securityGateway, userSessionRepository, systemParameterRepository,
                        sessionSecurityGateway);
        }
}
