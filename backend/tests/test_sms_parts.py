import pytest

from app.sms_parts import calculate_message_parts, render_pattern
from app.wallets.pricing import message_price


@pytest.mark.parametrize("message,parts,price", [
    ("", 1, 750), ("a" * 160, 1, 750), ("a" * 161, 2, 1500),
    ("a" * 306, 2, 1500), ("a" * 307, 3, 2250),
    ("س" * 70, 1, 500), ("س" * 71, 2, 1000),
    ("س" * 132, 2, 1000), ("س" * 133, 3, 1500),
    ("a" * 69 + "س", 1, 500), ("a" * 70 + "س", 2, 1000),
    ("\u0080" * 160, 1, 750), ("é" * 71, 2, 1000),
    ("🌱" * 35, 1, 500), ("🌱" * 36, 2, 1000),
])
def test_parts_and_price_match_supplied_algorithm(message, parts, price):
    assert calculate_message_parts(message) == parts
    assert message_price(message) == price


def test_default_characters_force_unicode_even_for_zero():
    assert calculate_message_parts("a" * 71) == 1
    assert calculate_message_parts("a" * 71, 0) == 2
    assert calculate_message_parts("a" * 60, 10) == 1
    assert calculate_message_parts("a" * 60, 11) == 2
    with pytest.raises(ValueError):
        calculate_message_parts("", -1)


def test_render_preserves_text_and_does_not_reinterpret_user_input():
    assert render_pattern("یادآوری\n{title}\n{time}", {"title": "{amount}", "time": "09:00"}) == "یادآوری\n{amount}\n09:00"


@pytest.mark.parametrize("body", ["{unknown}", "{title.upper}", "{title[0]}", "{title!r}", "{title:50}", "{"])
def test_unsupported_provider_placeholders_rejected(body):
    with pytest.raises(ValueError):
        render_pattern(body, {"title": "test"})
