package co.automationia.consumer.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Slf4j
@Configuration
public class RestConsumerConfig {

    @Value("${adapters.wompi.base-url}")
    private String wompiBaseUrl;

    @Bean("adapter.wompi")
    public WebClient wompiClient(WebClient.Builder builder) {
        log.info("Configurando WebClient para Wompi con base URL: {}", wompiBaseUrl);

        return builder
                .baseUrl(wompiBaseUrl)
                .build();
    }
}