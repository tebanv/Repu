package co.automationia.consumer.model;

import lombok.Data;

import java.util.List;

@Data
public class WompiMerchantResponse {

    private DataSection data;
    private Meta meta;

    @lombok.Data
    public static class DataSection {
        private Long id;
        private String name;
        private String email;
        private String contact_name;
        private String phone_number;
        private boolean active;
        private String logo_url;
        private String legal_name;
        private String legal_id_type;
        private String legal_id;
        private String public_key;
        private List<String> accepted_currencies;
        private List<String> accepted_payment_methods;
        private List<PaymentMethod> payment_methods;

        private PresignedAcceptance presigned_acceptance;
        private PresignedAcceptance presigned_personal_data_auth;

        private String fraud_javascript_key;
        private List<String> fraud_groups;
        private String click_to_pay_dpa_id;
        private String mcc;
        private String acquirer_id;
    }

    @lombok.Data
    public static class PaymentMethod {
        private String name;
        private List<Processor> payment_processors;
    }

    @lombok.Data
    public static class Processor {
        private String name;
    }

    @lombok.Data
    public static class PresignedAcceptance {
        private String acceptance_token;
        private String permalink;
        private String type;
    }

    @lombok.Data
    public static class Meta {
    }
}
