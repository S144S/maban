"""SMS part counting matching the product's JavaScript algorithm (UTF-16 units)."""

from string import Formatter


def english_content(message: str) -> bool:
    return all(ord(character) <= 128 for character in message)


def calculate_message_parts(message: str, default_characters: int | None = None) -> int:
    if default_characters is not None and default_characters < 0:
        raise ValueError("Default characters must be nonnegative")
    english = english_content(message) and default_characters is None
    limit, overhead = (160, 7) if english else (70, 4)
    length = len(message.encode("utf-16-le", errors="surrogatepass")) // 2 + (default_characters or 0)
    parts = (length + limit - 1) // limit
    extra = parts * overhead if parts > 1 else 0
    return max(1, (length + extra + limit - 1) // limit)


def render_pattern(body: str, attributes: dict[str, str]) -> str:
    """Only plain provider attributes; no Python field access or formatting expressions."""
    for _, field, spec, conversion in Formatter().parse(body):
        if field is not None and (field not in attributes or spec or conversion):
            raise ValueError("Invalid reminder SMS body placeholder")
    return body.format_map(attributes)
