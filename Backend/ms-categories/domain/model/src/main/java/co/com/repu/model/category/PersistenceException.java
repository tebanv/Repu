package co.com.repu.model.category;

public class PersistenceException extends RuntimeException {

    private final Kind kind;

    public PersistenceException(Kind kind) {
        this(kind, null);
    }

    public PersistenceException(Kind kind, Throwable cause) {
        super("Category persistence operation failed", cause);
        this.kind = kind;
    }

    public Kind getKind() {
        return kind;
    }

    public enum Kind {
        DUPLICATE,
        INVALID_REFERENCE,
        INVALID_VALUE,
        UNAVAILABLE
    }
}
