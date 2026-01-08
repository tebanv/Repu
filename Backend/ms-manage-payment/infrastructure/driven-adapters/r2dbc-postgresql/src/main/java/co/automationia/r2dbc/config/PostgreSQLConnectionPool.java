package co.automationia.r2dbc.config;

import io.r2dbc.pool.ConnectionPool;
import io.r2dbc.pool.ConnectionPoolConfiguration;
import io.r2dbc.postgresql.PostgresqlConnectionConfiguration;
import io.r2dbc.postgresql.PostgresqlConnectionFactory;
import io.r2dbc.spi.ConnectionFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Slf4j
@Configuration
@EnableConfigurationProperties(PostgresqlConnectionProperties.class)
public class PostgreSQLConnectionPool {

    private static final int INITIAL_POOL_SIZE = 10;
    private static final int MAX_POOL_SIZE = 20;
    private static final Duration MAX_IDLE_TIME = Duration.ofMinutes(30);

    @Bean
    public ConnectionFactory connectionFactory(PostgresqlConnectionProperties properties) {
        log.info(
                "Inicializando pool de conexiones PostgreSQL. Host: {}, Puerto: {}, Base de datos: {}",
                properties.host(),
                properties.port(),
                properties.database()
        );

        PostgresqlConnectionConfiguration connectionConfiguration =
                buildConnectionConfiguration(properties);

        ConnectionPoolConfiguration poolConfiguration =
                buildPoolConfiguration(connectionConfiguration);

        log.info(
                "Pool de conexiones PostgreSQL inicializado. Tamaño inicial: {}, Tamaño máximo: {}",
                INITIAL_POOL_SIZE,
                MAX_POOL_SIZE
        );

        return new ConnectionPool(poolConfiguration);
    }

    private PostgresqlConnectionConfiguration buildConnectionConfiguration(
            PostgresqlConnectionProperties properties
    ) {
        return PostgresqlConnectionConfiguration.builder()
                .host(properties.host())
                .port(properties.port())
                .database(properties.database())
                .schema(properties.schema())
                .username(properties.username())
                .password(properties.password())
                .build();
    }

    private ConnectionPoolConfiguration buildPoolConfiguration(
            PostgresqlConnectionConfiguration connectionConfiguration
    ) {
        return ConnectionPoolConfiguration.builder()
                .connectionFactory(new PostgresqlConnectionFactory(connectionConfiguration))
                .initialSize(INITIAL_POOL_SIZE)
                .maxSize(MAX_POOL_SIZE)
                .maxIdleTime(MAX_IDLE_TIME)
                .build();
    }
}