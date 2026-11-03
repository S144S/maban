import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import Settings
from app.main import create_app

HEADERS = {"Origin": "http://127.0.0.1:6201", "X-Maban-Request": "1"}


@pytest.fixture
def app(monkeypatch):
    url = make_url(
        os.getenv(
            "MABAN_TEST_DATABASE_URL", "postgresql+psycopg://maban:maban_local@127.0.0.1:54339/maban_test"
        )
    )
    if not url.database or not url.database.endswith("_test"):
        pytest.fail("Tests require a dedicated database whose name ends in _test")
    # Each test owns a database so fixed module schemas cannot overlap.
    database_name = "maban_" + uuid4().hex + "_test"
    engine = create_engine(url, isolation_level="AUTOCOMMIT")
    with engine.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    scoped_url = url.set(database=database_name).render_as_string(hide_password=False)
    settings = Settings(environment="test", database_url=scoped_url, secret_key="test-secret-" + "x" * 40)
    monkeypatch.setenv("MABAN_DATABASE_URL", scoped_url)
    monkeypatch.setenv("MABAN_ENVIRONMENT", "test")
    monkeypatch.setenv("MABAN_SECRET_KEY", settings.secret_key)
    application = None
    try:
        command.upgrade(Config("alembic.ini"), "head")
        application = create_app(settings)
        yield application
    finally:
        if application is not None:
            application.state.engine.dispose()
        with engine.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{database_name}" WITH (FORCE)'))
        engine.dispose()


@pytest.fixture
def client(app):
    with TestClient(app, headers=HEADERS) as client:
        yield client
