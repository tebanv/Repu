package co.repu.config;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import static org.junit.jupiter.api.Assertions.assertTrue;
import co.repu.model.system.gateways.SystemParameterRepository;
import co.repu.model.users.gateways.SecurityGateway;
import co.repu.model.users.gateways.SessionSecurityGateway;
import co.repu.model.users.gateways.UserSessionRepository;
import co.repu.model.users.gateways.UsersRepository;

class UseCasesConfigTest {

    @Test
    void testUseCaseBeansExist() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(TestConfig.class)) {
            String[] beanNames = context.getBeanDefinitionNames();

            boolean useCaseBeanFound = false;
            for (String beanName : beanNames) {
                if (beanName.endsWith("UseCase")) {
                    useCaseBeanFound = true;
                    break;
                }
            }

            assertTrue(useCaseBeanFound, "No beans ending with 'Use Case' were found");
        }
    }

    @Configuration
    @Import(UseCasesConfig.class)
    static class TestConfig {

        @Bean
        public MyUseCase myUseCase() {
            return new MyUseCase();
        }

        @Bean
        public UsersRepository usersRepository() {
            return org.mockito.Mockito.mock(UsersRepository.class);
        }

        @Bean
        public SecurityGateway securityGateway() {
            return org.mockito.Mockito.mock(SecurityGateway.class);
        }

        @Bean
        public UserSessionRepository userSessionRepository() {
            return org.mockito.Mockito.mock(UserSessionRepository.class);
        }

        @Bean
        public SystemParameterRepository systemParameterRepository() {
            return org.mockito.Mockito.mock(SystemParameterRepository.class);
        }

        @Bean
        public SessionSecurityGateway sessionSecurityGateway() {
            return org.mockito.Mockito.mock(SessionSecurityGateway.class);
        }
    }

    static class MyUseCase {
        public String execute() {
            return "MyUseCase Test";
        }
    }
}