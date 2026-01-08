package co.automationia.r2dbc;

import co.automationia.r2dbc.model.PaymentTransactionEntity;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface PaymentTransactionReactiveRepository
        extends ReactiveCrudRepository<PaymentTransactionEntity, Long> {

    Mono<PaymentTransactionEntity> findByReference(String reference);

    Flux<PaymentTransactionEntity> findByStatus(String status);

    Mono<PaymentTransactionEntity> findByWompiTransactionId(String wompiTransactionId);

    @Modifying
    @Query("""
            UPDATE pago_transaccion 
            SET estado = :status, 
                mensaje_estado = :message, 
                codigo_respuesta_procesador = :code, 
                actualizado_en = NOW() 
            WHERE id = :id
            """)
    Mono<Void> updateStatus(
            @Param("id") Long id,
            @Param("status") String status,
            @Param("message") String message,
            @Param("code") String code
    );

}