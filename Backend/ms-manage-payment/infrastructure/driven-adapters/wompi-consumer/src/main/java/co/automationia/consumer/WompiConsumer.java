package co.automationia.consumer;

import co.automationia.consumer.model.WompiCardTokenRequest;
import co.automationia.consumer.model.WompiCardTokenResponse;
import co.automationia.consumer.model.WompiTransactionRequest;
import co.automationia.consumer.model.WompiTransactionResponse;
import co.automationia.model.payment.CardToken;
import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.WompiAcceptance;
import co.automationia.model.payment.gateways.WompiRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Slf4j
@Repository
@RequiredArgsConstructor
public class WompiConsumer implements WompiRepository {

    private final RestConsumer client;

    @Value("${adapters.wompi.public-key}")
    private String publicKey;

    @Value("${adapters.wompi.private-key}")
    private String privateKey;

    @Value("${adapters.wompi.integrity-secret}")
    private String integritySecret;

    @Override
    public Mono<CardToken> tokenizeCard(
            String number,
            String cvc,
            String expMonth,
            String expYear,
            String cardHolder
    ) {
        WompiCardTokenRequest request = WompiCardTokenRequest.builder()
                .number(number)
                .cvc(cvc)
                .expMonth(expMonth)
                .expYear(expYear)
                .cardHolder(cardHolder)
                .build();

        log.info("Iniciando tokenización de tarjeta");

        return client.post(
                        "/tokens/cards",
                        request,
                        WompiCardTokenResponse.class,
                        "Bearer " + publicKey
                )
                .flatMap(resp -> {
                    var data = resp.getData();
                    if (data == null) {
                        return Mono.error(new IllegalStateException("Respuesta inválida al tokenizar tarjeta"));
                    }

                    log.info("Tokenización de tarjeta completada correctamente");

                    return Mono.just(
                            CardToken.builder()
                                    .id(data.getId())
                                    .brand(data.getBrand())
                                    .name(data.getName())
                                    .lastFour(data.getLastFour())
                                    .bin(data.getBin())
                                    .expMonth(data.getExpMonth())
                                    .expYear(data.getExpYear())
                                    .cardHolder(data.getCardHolder())
                                    .status("CREATED")
                                    .build()
                    );
                })
                .doOnError(ex -> log.error("Error técnico durante la tokenización de tarjeta", ex));
    }

    @Override
    public Mono<PaymentTransaction> createTransaction(
            PaymentTransaction tx,
            String acceptanceToken
    ) {
        String signature = buildIntegritySignature(tx);

        WompiTransactionRequest request = WompiTransactionRequest.builder()
                .amountInCents(tx.getAmountInCents())
                .currency(tx.getCurrency())
                .reference(tx.getReference())
                .paymentMethodType(tx.getPaymentMethodType())
                .acceptanceToken(acceptanceToken)
                .customerEmail(tx.getCustomerEmail())
                .signature(signature)
                .paymentMethod(
                        WompiTransactionRequest.PaymentMethod.builder()
                                .type("CARD")
                                .installments(tx.getInstallments())
                                .token(tx.getToken())
                                .build()
                )
                .build();

        log.info("Iniciando creación de transacción de pago");

        return client.post(
                        "/transactions",
                        request,
                        WompiTransactionResponse.class,
                        "Bearer " + privateKey
                )
                .flatMap(resp -> {
                    var data = resp.getData();
                    if (data == null) {
                        return Mono.error(new IllegalStateException("Respuesta inválida al crear transacción"));
                    }

                    log.info("Transacción creada correctamente en el proveedor de pagos");

                    var pm = data.getPaymentMethod();
                    var extra = pm != null ? pm.getExtra() : null;

                    return Mono.just(
                            PaymentTransaction.builder()
                                    .wompiTransactionId(data.getId())
                                    .reference(data.getReference())
                                    .amountInCents(data.getAmountInCents())
                                    .currency(data.getCurrency())
                                    .paymentMethodType(data.getPaymentMethodType())
                                    .installments(pm != null ? pm.getInstallments() : null)
                                    .status(data.getStatus())
                                    .statusMessage(data.getStatusMessage())
                                    .processorResponseCode(extra != null ? extra.getProcessorResponseCode() : null)
                                    .companyId(tx.getCompanyId())
                                    .entityId(tx.getEntityId())
                                    .customerEmail(tx.getCustomerEmail())
                                    .build()
                    );
                })
                .doOnError(ex -> log.error("Error técnico durante la creación de la transacción", ex));
    }

    @Override
    public Mono<PaymentTransaction> getTransactionStatus(String wompiTransactionId) {
        log.info("Consultando estado de transacción de pago");

        return client.get(
                        "/transactions/" + wompiTransactionId,
                        WompiTransactionResponse.class,
                        "Bearer " + privateKey
                )
                .flatMap(resp -> {
                    var data = resp.getData();
                    if (data == null) {
                        return Mono.error(new IllegalStateException("Respuesta inválida al consultar estado"));
                    }

                    var pm = data.getPaymentMethod();
                    var extra = pm != null ? pm.getExtra() : null;

                    return Mono.just(
                            PaymentTransaction.builder()
                                    .wompiTransactionId(data.getId())
                                    .reference(data.getReference())
                                    .amountInCents(data.getAmountInCents())
                                    .currency(data.getCurrency())
                                    .paymentMethodType(data.getPaymentMethodType())
                                    .installments(pm != null ? pm.getInstallments() : null)
                                    .status(data.getStatus())
                                    .statusMessage(data.getStatusMessage())
                                    .processorResponseCode(extra != null ? extra.getProcessorResponseCode() : null)
                                    .build()
                    );
                })
                .doOnError(ex -> log.error("Error técnico al consultar estado de la transacción", ex));
    }

    @Override
    public Mono<WompiAcceptance> getAcceptanceToken() {
        log.info("Obteniendo acceptance token del proveedor de pagos");

        return client.getMerchantInfo("/merchants/" + publicKey, "")
                .flatMap(resp -> {
                    var data = resp.getData();
                    if (data == null ||
                            data.getPresigned_acceptance() == null ||
                            data.getPresigned_acceptance().getAcceptance_token() == null) {
                        return Mono.error(new IllegalStateException("No fue posible obtener el acceptance token"));
                    }

                    log.info("Acceptance token obtenido correctamente");

                    return Mono.just(
                            WompiAcceptance.builder()
                                    .acceptanceToken(
                                            data.getPresigned_acceptance().getAcceptance_token()
                                    )
                                    .build()
                    );
                })
                .doOnError(ex -> log.error("Error técnico al obtener acceptance token", ex));
    }

    private String buildIntegritySignature(PaymentTransaction tx) {
        try {
            String raw = tx.getReference()
                    + tx.getAmountInCents()
                    + tx.getCurrency()
                    + integritySecret;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();

        } catch (Exception ex) {
            log.error("Error técnico al generar firma de integridad", ex);
            throw new IllegalStateException("No fue posible generar la firma de integridad", ex);
        }
    }
}