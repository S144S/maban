from app.sms_parts import calculate_message_parts, english_content

PERSIAN_PART_TOMAN = 500
ENGLISH_PART_TOMAN = 750


def message_price(message: str) -> int:
    rate = ENGLISH_PART_TOMAN if english_content(message) else PERSIAN_PART_TOMAN
    return calculate_message_parts(message) * rate
