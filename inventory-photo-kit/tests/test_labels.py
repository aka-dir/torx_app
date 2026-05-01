"""Tests for label normalization."""

from photosort.labels import normalize_label, parse_classify_reply


def test_whitelist_match() -> None:
    allowed = ["exterior_front", "unclassified"]
    assert normalize_label("exterior_front", allowed) == "exterior_front"
    assert normalize_label("The answer is exterior_front.", allowed) == "exterior_front"


def test_empty_allowed_passthrough() -> None:
    assert normalize_label("  hello  ", []) == "hello"


def test_fallback_unclassified() -> None:
    allowed = ["a", "unclassified"]
    assert normalize_label("no known token here", allowed) == "unclassified"


def test_parse_classify_reply_vehicle_line() -> None:
    allowed = ["trunk_open", "unclassified"]
    raw = "trunk_open\nVEHICLE: Volkswagen Golf"
    label, vehicle = parse_classify_reply(raw, allowed)
    assert label == "trunk_open"
    assert vehicle == "Volkswagen Golf"


def test_parse_classify_reply_unknown_vehicle() -> None:
    allowed = ["trunk_open", "unclassified"]
    label, vehicle = parse_classify_reply("trunk_open\nVEHICLE: unknown", allowed)
    assert label == "trunk_open"
    assert vehicle == ""


def test_parse_classify_reply_dutch_label_and_voertuig() -> None:
    allowed = ["kofferbak_open", "niet_geclassificeerd"]
    raw = "kofferbak_open\nVOERTUIG: Volkswagen Golf"
    label, vehicle = parse_classify_reply(raw, allowed)
    assert label == "kofferbak_open"
    assert vehicle == "Volkswagen Golf"


def test_fallback_niet_geclassificeerd() -> None:
    allowed = ["kofferbak_open", "niet_geclassificeerd"]
    assert normalize_label("geen bekende term", allowed) == "niet_geclassificeerd"
