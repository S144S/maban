import re
from importlib.metadata import version
from pathlib import Path

root = Path(__file__).resolve().parents[1]
current = (root / "VERSION").read_text().strip()
assert re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", current)
assert version("maban-backend") == current, "Run uv sync after changing VERSION"
assert f"Current development version: `{current}`" in (root / "CHANGELOG.md").read_text()
print(f"Backend version {current}: metadata and changelog are consistent.")
