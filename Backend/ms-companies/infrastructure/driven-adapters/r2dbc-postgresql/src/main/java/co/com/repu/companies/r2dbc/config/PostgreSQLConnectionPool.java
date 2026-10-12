package co.com.repu.companies.r2dbc.config;

import java.time.Duration;
import io.r2dbc.pool.ConnectionPool;
import io.r2dbc.pool.ConnectionPoolConfiguration;
import io.r2dbc.postgresql.PostgresqlConnectionConfiguration;
import org.springframework.beans.factory.annotation.Value;
import io.r2dbc.postgresql.PostgresqlConnectionFactory;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PostgreSQLConnectionPool {
    // TODO: change pool connection properties based on your resources.
    public static final int INITIAL_SIZE = 12;
    public static final int MAX_SIZE = 15;
    public static final int MAX_IDLE_TIME = 30;

	// Inyectamos valores desde application.yaml
	@Value("${spring.r2dbc.url}")
	private String url; // Ejemplo: r2dbc:postgresql://localhost:5435/repu

	@Value("${spring.r2dbc.username}")
	private String username;

	@Value("${spring.r2dbc.password}")
	private String password;

	@Value("${spring.r2dbc.properties.schema}")
	private String schema;

	@Bean
	public ConnectionPool getConnectionConfig() {
		// Parseamos la URL manualmente o usamos el builder limpio
		// Nota: Al usar la URL completa, R2DBC suele autoconfigurarse,
		// pero si queremos control manual del Pool:

		// Extraer host y puerto de la URL (r2dbc:postgresql://host:port/db)
		// Esto es un hack rápido, lo ideal es usar R2dbcProperties de Spring
		String cleanUrl = url.replace("r2dbc:postgresql://", "");
		String[] parts = cleanUrl.split("/");
		String hostPort = parts[0];
		String dbName = parts[1];

		String[] hostInfo = hostPort.split(":");
		String host = hostInfo[0];
		int port = Integer.parseInt(hostInfo[1]);

		return buildConnectionConfiguration(host, port, dbName, schema, username, password);
	}

	private ConnectionPool buildConnectionConfiguration(String host, int port, String db, String schema, String user, String pass) {
		PostgresqlConnectionConfiguration dbConfiguration = PostgresqlConnectionConfiguration.builder()
				.host(host)
				.port(port) // ¡Aquí estaba el error! Debe ser 5435 si es localhost
				.database(db)
				.schema(schema)
				.username(user)
				.password(pass)
				.build();

		ConnectionPoolConfiguration poolConfiguration = ConnectionPoolConfiguration.builder()
				.connectionFactory(new PostgresqlConnectionFactory(dbConfiguration))
				.name("api-postgres-connection-pool")
				.initialSize(12)
				.maxSize(15)
				.maxIdleTime(Duration.ofMinutes(30))
				.validationQuery("SELECT 1")
				.build();

		return new ConnectionPool(poolConfiguration);
	}
}
