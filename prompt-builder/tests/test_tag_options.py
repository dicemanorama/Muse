import importlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

config = importlib.import_module("config")


PRE_EXPANSION_COUNTS = {
    "Subject": 177,
    "Location": 195,
    "Action": 134,
    "Style": 138,
    "Mood": 131,
    "Lighting": 84,
    "Camera": 83,
    "Color": 84,
    "Detail": 84,
}


def test_each_tag_section_has_twice_as_many_options():
    assert set(config.TAGS) == set(PRE_EXPANSION_COUNTS)
    for category, previous_count in PRE_EXPANSION_COUNTS.items():
        assert len(config.TAGS[category]) == previous_count * 2


def test_each_tag_dropdown_is_case_insensitively_alphabetized_and_unique():
    for values in config.TAGS.values():
        assert values == sorted(values, key=str.casefold)
        assert len(values) == len({value.casefold() for value in values})


def test_expansion_does_not_pad_existing_tags_with_generic_suffixes():
    rejected_phrases = {
        "in a narrative scene",
        "during changing weather",
        "as the pivotal moment",
        "with contemporary refinement",
        "emotionally layered",
        "with atmospheric diffusion",
        "with layered depth",
        "with nuanced tonal contrast",
        "with tactile micro-detail",
    }
    for values in config.TAGS.values():
        for value in values:
            assert not any(phrase in value for phrase in rejected_phrases)
