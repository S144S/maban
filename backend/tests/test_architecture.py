"""Executable module ownership rules; new app packages are domain modules by default."""

import ast
from dataclasses import FrozenInstanceError, fields
from pathlib import Path
from uuid import uuid4

import pytest

from app.users.persistence import TABLES
from app.users.public import UserIdentity

APP = Path(__file__).resolve().parents[1] / "app"


def imports(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    package = ["app", *path.relative_to(APP).parts[:-1]]
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            prefix = package[: len(package) - node.level + 1] if node.level else []
            base = ".".join([*prefix, *([node.module] if node.module else [])])
            yield base
            yield from (base + "." + alias.name for alias in node.names)


def test_module_import_boundaries():
    modules = {p.name for p in APP.iterdir() if p.is_dir() and (p / "__init__.py").exists()}
    exceptions = {
        "main.py": {"app.users.bootstrap", "app.families.bootstrap", "app.income.bootstrap", "app.expenses.bootstrap", "app.money_locations.bootstrap", "app.investments.bootstrap", "app.assets.bootstrap"},
        "cli.py": {"app.users.commands"},
    }
    for path in APP.rglob("*.py"):
        relative = path.relative_to(APP)
        owner = relative.parts[0] if len(relative.parts) > 1 else None
        for imported in imports(path):
            parts = imported.split(".")
            if len(parts) < 2 or parts[0] != "app" or parts[1] not in modules:
                continue
            if parts[1] == owner:
                continue
            allowed = {f"app.{parts[1]}.public", *exceptions.get(relative.as_posix(), set())}
            # Package import is allowed only as a prefix of an explicitly checked from-import.
            if len(parts) == 2:
                continue
            assert any(imported == name or imported.startswith(name + ".") for name in allowed), (
                f"{relative} imports module internals: {imported}"
            )


def test_http_and_cli_do_not_access_persistence():
    for path in (APP / "users/routes.py", APP / "families/routes.py", APP / "income/routes.py", APP / "expenses/routes.py", APP / "money_locations/routes.py", APP / "investments/routes.py", APP / "assets/routes.py", APP / "cli.py"):
        names = list(imports(path))
        assert not any(n.startswith("sqlalchemy") or ".models" in n for n in names)
        tree = ast.parse(path.read_text(encoding="utf-8"))
        assert not any(isinstance(n, ast.Attribute) and n.attr == "db" for n in ast.walk(tree))


def test_user_identity_is_immutable_and_contains_no_persistence_state():
    identity = UserIdentity(id=uuid4(), role="user")
    assert {f.name for f in fields(identity)} == {"id", "role"}
    assert not hasattr(identity, "__dict__")
    with pytest.raises(FrozenInstanceError):
        identity.role = "admin"


def test_users_owns_its_tables_and_foreign_keys():
    assert len(TABLES) == 4
    for table in TABLES:
        assert table.schema == "users"
        for foreign_key in table.foreign_keys:
            assert foreign_key.column.table.schema == "users"


def test_business_module_dependencies_are_acyclic():
    modules = {p.name for p in APP.iterdir() if p.is_dir() and (p / "__init__.py").exists()}
    edges = {name: set() for name in modules}
    for name in modules:
        for path in (APP / name).rglob("*.py"):
            for imported in imports(path):
                parts = imported.split(".")
                if len(parts) >= 2 and parts[0] == "app" and parts[1] in modules and parts[1] != name:
                    edges[name].add(parts[1])

    def visit(name, ancestors):
        assert name not in ancestors, f"Cyclic module dependency: {ancestors} -> {name}"
        for dependency in edges[name]:
            visit(dependency, (*ancestors, name))

    for name in modules:
        visit(name, ())
