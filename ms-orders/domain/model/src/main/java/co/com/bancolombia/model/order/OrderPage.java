package co.com.bancolombia.model.order;

import java.util.List;

public record OrderPage(List<Order> content, long totalElements, int number, int size) {
    public OrderPage {
        content = List.copyOf(content);
    }

    public int totalPages() {
        return size == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
    }
}
