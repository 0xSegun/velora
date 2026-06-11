"""ISO 3166-1 alpha-2 country code to flag emoji."""


def country_code_to_flag(code: str | None) -> str:
    """Convert a two-letter ISO country code to a regional-indicator flag emoji."""
    if not code or len(code) != 2:
        return "🌐"
    upper = code.upper()
    if not upper.isalpha():
        return "🌐"
    return "".join(chr(0x1F1E6 + ord(char) - ord("A")) for char in upper)