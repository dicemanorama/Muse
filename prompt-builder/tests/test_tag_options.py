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
