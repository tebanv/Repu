package co.repu.model.users;

import java.util.regex.Pattern;

public class PasswordValidator {
    // Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un caracter especial
    private static final String PASSWORD_REGEX =
            "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+-;:=*.!])(?=\\S+$).{8,}$";

    private static final Pattern PATTERN = Pattern.compile(PASSWORD_REGEX);

    public static boolean isValid(String password) {
        return password != null && PATTERN.matcher(password).matches();
    }
}
