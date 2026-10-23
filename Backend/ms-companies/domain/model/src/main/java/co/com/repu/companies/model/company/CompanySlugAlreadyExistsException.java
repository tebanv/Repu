package co.com.repu.companies.model.company;

public class CompanySlugAlreadyExistsException extends RuntimeException {

    public CompanySlugAlreadyExistsException() {
        super("Company slug is already in use");
    }
}
