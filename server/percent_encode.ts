export function percentEncode(string: string) {
    return string.split("").map(char => {
        if (false
            || (char >= '0' && char <= '9')
            || (char >= 'A' && char <= 'Z')
            || (char >= 'a' && char <= 'z')
            || (char == '-') || (char == '.')
            || (char == '_') || (char == '~')
        ) {
            return char;
        } else {
            return '%' + char.charCodeAt(0).toString(16).toUpperCase();
        }
    }).join("");
};