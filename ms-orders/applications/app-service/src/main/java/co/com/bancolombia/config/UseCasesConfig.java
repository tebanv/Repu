package co.com.bancolombia.config;

import co.com.bancolombia.model.cart.gateways.CartRepository;
import co.com.bancolombia.model.order.ReservationPolicy;
import co.com.bancolombia.model.order.gateways.OrderEventPublisher;
import co.com.bancolombia.model.order.gateways.OrderRepository;
import co.com.bancolombia.model.order.gateways.TransactionRunner;
import co.com.bancolombia.usecase.acceptorder.AcceptOrderUseCase;
import co.com.bancolombia.usecase.additemtocart.AddItemToCartUseCase;
import co.com.bancolombia.usecase.cancelorder.CancelOrderUseCase;
import co.com.bancolombia.usecase.checkoutorder.CheckoutOrderUseCase;
import co.com.bancolombia.usecase.expireinventoryreservations.ExpireInventoryReservationsUseCase;
import co.com.bancolombia.usecase.getactivecart.GetActiveCartUseCase;
import co.com.bancolombia.usecase.getactiveorders.GetActiveOrdersUseCase;
import co.com.bancolombia.usecase.getcurrentlocation.GetCurrentLocationUseCase;
import co.com.bancolombia.usecase.getorderdetails.GetOrderDetailsUseCase;
import co.com.bancolombia.usecase.listorders.ListOrdersUseCase;
import co.com.bancolombia.usecase.markorderready.MarkOrderReadyUseCase;
import co.com.bancolombia.usecase.rejectorder.RejectOrderUseCase;
import co.com.bancolombia.usecase.removeitemfromcart.RemoveItemFromCartUseCase;
import co.com.bancolombia.usecase.subscribetoorderlivestream.SubscribeToOrderLiveStreamUseCase;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.SecureRandom;

@Configuration
@EnableConfigurationProperties(OrdersProperties.class)
public class UseCasesConfig {
    @Bean
    public GetActiveCartUseCase getActiveCartUseCase(CartRepository carts) {
        return new GetActiveCartUseCase(carts);
    }

    @Bean
    public AddItemToCartUseCase addItemToCartUseCase(CartRepository carts, TransactionRunner transactions) {
        return new AddItemToCartUseCase(carts, transactions);
    }

    @Bean
    public RemoveItemFromCartUseCase removeItemFromCartUseCase(CartRepository carts, TransactionRunner transactions) {
        return new RemoveItemFromCartUseCase(carts, transactions);
    }

    @Bean
    public CheckoutOrderUseCase checkoutOrderUseCase(CartRepository carts, OrderRepository orders,
                                                     TransactionRunner transactions, ReservationPolicy policy,
                                                     OrderEventPublisher events) {
        return new CheckoutOrderUseCase(carts, orders, transactions, policy.reservationTtl(), events);
    }

    @Bean
    public ListOrdersUseCase listOrdersUseCase(OrderRepository orders) {
        return new ListOrdersUseCase(orders);
    }

    @Bean
    public GetActiveOrdersUseCase getActiveOrdersUseCase(OrderRepository orders) {
        return new GetActiveOrdersUseCase(orders);
    }

    @Bean
    public GetOrderDetailsUseCase getOrderDetailsUseCase(OrderRepository orders) {
        return new GetOrderDetailsUseCase(orders);
    }

    @Bean
    public CancelOrderUseCase cancelOrderUseCase(OrderRepository orders, TransactionRunner transactions,
                                                 OrderEventPublisher events) {
        return new CancelOrderUseCase(orders, transactions, events);
    }

    @Bean
    public SubscribeToOrderLiveStreamUseCase subscribeToOrderLiveStreamUseCase(
            OrderRepository orders, OrderEventPublisher events) {
        return new SubscribeToOrderLiveStreamUseCase(orders, events);
    }

    @Bean
    public AcceptOrderUseCase acceptOrderUseCase(OrderRepository orders, TransactionRunner transactions,
                                                 OrderEventPublisher events) {
        return new AcceptOrderUseCase(orders, transactions, events);
    }

    @Bean
    public RejectOrderUseCase rejectOrderUseCase(OrderRepository orders, TransactionRunner transactions,
                                                 OrderEventPublisher events) {
        return new RejectOrderUseCase(orders, transactions, events);
    }

    @Bean
    public MarkOrderReadyUseCase markOrderReadyUseCase(OrderRepository orders, TransactionRunner transactions,
                                                       OrderEventPublisher events) {
        return new MarkOrderReadyUseCase(orders, transactions, events, new SecureRandom());
    }

    @Bean
    public ExpireInventoryReservationsUseCase expireInventoryReservationsUseCase(
            OrderRepository orders, TransactionRunner transactions) {
        return new ExpireInventoryReservationsUseCase(orders, transactions);
    }

    @Bean
    public GetCurrentLocationUseCase getCurrentLocationUseCase(OrderRepository orders) {
        return new GetCurrentLocationUseCase(orders);
    }
}
