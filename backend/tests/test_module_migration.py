from dataclasses import asdict

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from test_users import register

from app.users.public import CurrentUser


def test_public_identity_dependency(client, app):
    @app.get("/test/module-consumer")
    def consumer(identity: CurrentUser):
        return asdict(identity)

    assert client.get("/test/module-consumer").status_code == 401
    user = register(client)
    assert client.get("/test/module-consumer").json() == {"id": user["id"], "role": "user"}
    client.post("/api/auth/logout")
    assert client.get("/test/module-consumer").status_code == 401


def test_schema_migration_preserves_accounts_sessions_and_constraints(client, app):
    user = register(client)
    engine = app.state.engine
    tables = ("users", "user_sessions", "user_otp_challenges", "user_rate_buckets")
    with engine.connect() as connection:
        before = {name: connection.execute(text(f"SELECT * FROM users.{name}")).all() for name in tables}
        assert all(before.values())
    config = Config("alembic.ini")
    command.downgrade(config, "54574e5efd16")
    with engine.connect() as connection:
        assert "users" not in inspect(connection).get_schema_names()
        for name in tables:
            assert connection.execute(text(f"SELECT * FROM public.{name}")).all() == before[name]
    command.upgrade(config, "head")
    with engine.connect() as connection:
        inspector = inspect(connection)
        assert not set(tables) & set(inspector.get_table_names(schema="public"))
        for name in tables:
            assert connection.execute(text(f"SELECT * FROM users.{name}")).all() == before[name]
        fk = inspector.get_foreign_keys("user_sessions", schema="users")[0]
        assert fk["referred_schema"] == "users"
        assert fk["options"]["ondelete"] == "CASCADE"
        assert inspector.get_unique_constraints("users", schema="users")[0]["column_names"] == ["phone"]
    assert client.get("/api/users/me").json()["user"]["id"] == user["id"]
    command.check(config)
