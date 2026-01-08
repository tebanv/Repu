package co.automationia.r2dbc.helper;

import co.automationia.model.payment.PaymentTransaction;
import co.automationia.model.payment.gateways.PaymentTransactionRepository;
import co.automationia.r2dbc.PaymentTransactionReactiveRepository;
import co.automationia.r2dbc.model.PaymentTransactionEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Objects;

@Slf4j
@Repository
@RequiredArgsConstructor
public class PaymentTransactionRepositoryAdapter implements PaymentTransactionRepository {

    private final PaymentTransactionReactiveRepository repository;

    /* =========================
       Mapping
       ========================= */

    private PaymentTransaction toDomain(PaymentTransactionEntity entity) {
        Objects.requireNonNull(entity, "PaymentTransactionEntity no puede ser nula.");

        return PaymentTransaction.builder()
                .id(entity.getId())
                .wompiTransactionId(entity.getWompiTransactionId())
                .reference(entity.getReference())
                .paymentType(entity.getPaymentType())
                .entityId(entity.getEntityId())
                .companyId(entity.getCompanyId())
                .amountInCents(entity.getAmountInCents())
                .currency(entity.getCurrency())
                .paymentMethodType(entity.getPaymentMethodType())
                .installments(entity.getInstallments())
                .status(entity.getStatus())
                .statusMessage(entity.getStatusMessage())
                .processorResponseCode(entity.getProcessorResponseCode())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private PaymentTransactionEntity toEntity(PaymentTransaction domain) {
        Objects.requireNonNull(domain, "PaymentTransaction no puede ser nula.");

        return PaymentTransactionEntity.builder()
                .id(domain.getId())
                .wompiTransactionId(domain.getWompiTransactionId())
                .reference(domain.getReference())
                .paymentType(domain.getPaymentType())
                .entityId(domain.getEntityId())
                .companyId(domain.getCompanyId())
                .amountInCents(domain.getAmountInCents())
                .currency(domain.getCurrency())
                .paymentMethodType(domain.getPaymentMethodType())
                .installments(domain.getInstallments())
                .status(domain.getStatus())
                .statusMessage(domain.getStatusMessage())
                .processorResponseCode(domain.getProcessorResponseCode())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    /* =========================
       Persistence
       ========================= */

    @Override
    public Mono<PaymentTransaction> save(PaymentTransaction transaction) {
        if (transaction == null) {
            log.warn("Se intentó persistir una transacción de pago nula");
            return Mono.empty();
        }

        return repository.save(toEntity(transaction))
                .map(this::toDomain)
                .doOnSuccess(tx ->
                        log.info("Transacción de pago persistida correctamente")
                )
                .doOnError(ex ->
                        log.error("Error técnico al persistir la transacción de pago", ex)
                );
    }

    @Override
    public Mono<PaymentTransaction> findById(Long id) {
        if (id == null) {
            log.warn("Se intentó consultar una transacción con id nulo");
            return Mono.empty();
        }

        return repository.findById(id)
                .map(this::toDomain)
                .doOnError(ex ->
                        log.error("Error técnico al consultar transacción por id", ex)
                );
    }

    @Override
    public Mono<PaymentTransaction> findByReference(String reference) {
        if (reference == null || reference.isBlank()) {
            log.warn("Se intentó consultar una transacción con referencia inválida");
            return Mono.empty();
        }

        log.info("Se busca la referencia: {}", reference);

        return repository.findByReference(reference)
                .map(this::toDomain)
                .doOnError(ex ->
                        log.error("Error técnico al consultar transacción por referencia", ex)
                );
    }

    @Override
    public Flux<PaymentTransaction> findByStatus(String status) {
        if (status == null || status.isBlank()) {
            log.warn("Se intentó listar transacciones con estado inválido");
            return Flux.empty();
        }

        return repository.findByStatus(status)
                .map(this::toDomain)
                .doOnError(ex ->
                        log.error("Error técnico al listar transacciones por estado", ex)
                );
    }

    @Override
    public Mono<PaymentTransaction> findByWompiTransactionId(String wompiTransactionId) {
        if (wompiTransactionId == null || wompiTransactionId.isBlank()) {
            log.warn("Se intentó consultar una transacción con WompiTransactionId inválido");
            return Mono.empty();
        }

        return repository.findByWompiTransactionId(wompiTransactionId)
                .map(this::toDomain)
                .doOnError(ex ->
                        log.error("Error técnico al consultar transacción por WompiTransactionId", ex)
                );
    }

    @Override
    public Mono<PaymentTransaction> updateStatus(
            Long id,
            String newStatus,
            String message,
            String processorCode
    ) {
        if (id == null || newStatus == null) {
            log.warn("Parámetros inválidos al actualizar estado de transacción");
            return Mono.empty();
        }

        log.info("Se actualiza estado de la transacción: {}, a: {}, con mesanje: {} y processorCode: {}",
                id, newStatus, message, processorCode);

        return repository.updateStatus(id, newStatus, message, processorCode)
                .then(repository.findById(id))
                .map(this::toDomain)
                .doOnSuccess(tx ->
                        log.info("Estado de transacción actualizado en persistencia")
                )
                .doOnError(ex ->
                        log.error("Error técnico al actualizar estado de transacción", ex)
                );
    }
}