package co.com.repu.r2dbc;

import co.com.repu.model.user.gateways.PasswordResetNotifier;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Component
@RequiredArgsConstructor
public class EmailPasswordResetNotifier implements PasswordResetNotifier {

    private final JavaMailSender mailSender;

    @Value("${app.password-recovery.from}")
    private String sender;

    @Override
    public Mono<Void> sendCode(String email, String firstName, String code, int expirationMinutes) {
        return Mono.fromRunnable(() -> {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(sender);
            message.setTo(email);
            message.setSubject("Código para recuperar tu contraseña - REPU");
            message.setText("""
                    Hola %s,

                    Tu código de recuperación de contraseña es: %s

                    Este código vence en %d minutos y solo puede utilizarse una vez.
                    Si no solicitaste este cambio, ignora este mensaje.

                    Equipo REPU
                    """.formatted(firstName == null ? "usuario" : firstName, code, expirationMinutes));
            mailSender.send(message);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }
}
