package co.com.repu.companies.model.company;

public class CompanyAccessDeniedException extends RuntimeException {

    public CompanyAccessDeniedException() {
        super("User is not allowed to update this company");
    }
}
