package co.com.repu.companies.model.company;

public class PersistenceException extends RuntimeException {

    private final Kind kind;

    public PersistenceException(Kind kind) {
        this(kind, null);
    }

    public PersistenceException(Kind kind, Throwable cause) {
        super("Company persistence operation failed", cause);
        this.kind = kind;
    }

    public Kind getKind() {
        return kind;
    }

    public enum Kind {
        DUPLICATE,
        DUPLICATE_TAX_ID,
        DUPLICATE_SLUG,
        INVALID_REFERENCE,
        INVALID_VALUE,
        UNAVAILABLE
    }
}
