package co.automationia.consumer;

import co.automationia.consumer.model.WompiMerchantResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class RestConsumer {

    private final WebClient wompiClient;

    public <T> Mono<T> post(String uri, Object body, Class<T> responseType, String authHeader) {
        log.info("Solicitud POST a servicio externo");

        return wompiClient.post()
                .uri(uri)
                .header(HttpHeaders.AUTHORIZATION, authHeader)
                .bodyValue(body)
                .retrieve()
                .onStatus(this::isErrorStatus, resp -> handleHttpError("POST", uri, resp))
                .bodyToMono(responseType)
                .doOnSuccess(r ->
                        log.info("Respuesta POST procesada correctamente")
                )
                .doOnError(ex ->
                        log.error("Error técnico al ejecutar POST hacia servicio externo", ex)
                );
    }

    public <T> Mono<T> get(String uri, Class<T> responseType, String authHeader) {
        log.info("Solicitud GET a servicio externo");

        return wompiClient.get()
                .uri(uri)
                .header(HttpHeaders.AUTHORIZATION, authHeader)
                .retrieve()
                .onStatus(this::isErrorStatus, resp -> handleHttpError("GET", uri, resp))
                .bodyToMono(responseType)
                .doOnSuccess(r ->
                        log.info("Respuesta GET recibida correctamente")
                )
                .doOnError(ex ->
                        log.error("Error técnico al ejecutar GET hacia servicio externo", ex)
                );
    }

    public Mono<WompiMerchantResponse> getMerchantInfo(String uri, String authHeader) {
        log.info("Solicitud para obtener información del comercio");

        return wompiClient.get()
                .uri(uri)
                .header(HttpHeaders.AUTHORIZATION, authHeader)
                .retrieve()
                .onStatus(this::isErrorStatus, resp -> handleHttpError("GET", uri, resp))
                .bodyToMono(WompiMerchantResponse.class)
                .doOnSuccess(r ->
                        log.info("Información del comercio obtenida correctamente")
                )
                .doOnError(ex ->
                        log.error("Error técnico al obtener información del comercio", ex)
                );
    }

    private boolean isErrorStatus(org.springframework.http.HttpStatusCode status) {
        return status.is4xxClientError() || status.is5xxServerError();
    }

    private Mono<Throwable> handleHttpError(String method, String uri, ClientResponse response) {
        return response.bodyToMono(String.class)
                .defaultIfEmpty("")
                .doOnNext(body ->
                        log.error("Error HTTP {} al consumir servicio externo",
                                response.statusCode().value())
                )
                .map(body ->
                        new IllegalStateException("Error al consumir servicio externo"));
    }
}