package co.com.repu.model.product;

public class ProductAccessDeniedException extends RuntimeException {

    public ProductAccessDeniedException() {
        super("Product operation is not allowed");
    }
}
