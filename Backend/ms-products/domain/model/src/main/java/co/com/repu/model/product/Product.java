package co.com.repu.model.product;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Product {
    private String id;
    private String companyId;
    private String categoryId;
    private String name;
    private Integer sku;
    private String description;
    private BigDecimal price;
    private BigDecimal priceOffer;
    private Integer stock;

    private Object attributes;
    private List<String> images;

    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
