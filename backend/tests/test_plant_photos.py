from datetime import UTC, datetime, timedelta
from io import BytesIO
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from PIL import Image
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from test_families import accept, account, create, invite
from test_plants import payload
from test_users import register

from app.plants.cleanup import cleanup
from app.plants.errors import PlantError
from app.plants.models import Plant
from app.plants.photos import MAX_UPLOAD_BYTES, normalize_photo
from app.plants.storage import StoredPhoto


class MemoryPhotos:
    def __init__(self):
        self.data = {}
        self.modified = {}
        self.fail = set()

    def put(self, key, data):
        self.data[key] = data
        self.modified[key] = datetime.now(UTC)
        if "put" in self.fail:
            raise PlantError("ذخیره‌سازی عکس در دسترس نیست.", 503)

    def get(self, key):
        if "get" in self.fail:
            raise PlantError("ذخیره‌سازی عکس در دسترس نیست.", 503)
        return self.data[key]

    def remove(self, key):
        if "remove" in self.fail:
            raise PlantError("ذخیره‌سازی عکس در دسترس نیست.", 503)
        self.data.pop(key, None)
        self.modified.pop(key, None)

    def objects(self):
        return iter([StoredPhoto(key, self.modified[key]) for key in self.data])


@pytest.fixture
def store(app):
    app.state.plant_photos = MemoryPhotos()
    return app.state.plant_photos


def image_bytes(format="PNG", size=(64, 32), color="green", **options):
    output = BytesIO()
    Image.new("RGB", size, color).save(output, format=format, **options)
    return output.getvalue()


@pytest.mark.parametrize(("format", "mime"), [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_normalization_resizes_strips_metadata_and_orients(format, mime):
    exif = Image.Exif()
    exif[270], exif[274] = "private location", 6
    data = image_bytes(format, size=(2000, 1000), exif=exif)
    with Image.open(BytesIO(normalize_photo(data, mime))) as result:
        assert result.format == "JPEG" and result.size == (800, 1600)
        assert not result.getexif() and "icc_profile" not in result.info
    assert b"private location" not in normalize_photo(data, mime)


def test_invalid_and_animated_images_are_rejected(monkeypatch):
    for data, mime, status in [(b"", "image/png", 422), (b"<svg></svg>", "image/svg+xml", 415),
                               (b"not an image", "image/png", 422),
                               (image_bytes(), "image/jpeg", 415),
                               (image_bytes()[:40], "image/png", 422),
                               (b"x" * (MAX_UPLOAD_BYTES + 1), "image/png", 413)]:
        with pytest.raises(PlantError) as error:
            normalize_photo(data, mime)
        assert error.value.status == status
    animated = image_bytes(save_all=True, append_images=[Image.new("RGB", (64, 32), "red")])
    with pytest.raises(PlantError, match="متحرک"):
        normalize_photo(animated, "image/png")
    monkeypatch.setattr("app.plants.photos.MAX_PIXELS", 100)
    with pytest.raises(PlantError, match="مگاپیکسل"):
        normalize_photo(image_bytes(), "image/png")


def test_private_photo_full_flow_and_migration(client, app, store):
    register(client)
    family = create(client)
    base = f"/api/families/{family}/plants"
    original = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{original['id']}"
    photo = url + "/photo"
    assert original["photo_url"] is None
    assert client.get(photo).status_code == 404
    data = image_bytes()
    upload = client.put(photo, content=data, headers={"Content-Type": "image/png"})
    assert upload.status_code == 200, upload.text
    uploaded = upload.json()["plant"]
    assert uploaded["soil"] == original["soil"]
    assert uploaded["photo_url"].startswith(photo + "?v=")
    # PUT retry stores the same normalized bytes without touching care or schedules.
    assert client.put(photo, content=data, headers={"Content-Type": "image/png"}).json() == upload.json()
    assert len(store.data) == 1
    fetched = client.get(uploaded["photo_url"])
    assert fetched.status_code == 200 and fetched.headers["content-type"] == "image/jpeg"
    assert "no-store" in fetched.headers["cache-control"]
    assert client.get(base).json()["plants"][0]["photo_url"] == uploaded["photo_url"]
    assert client.get(url + "/history").json()["events"] == []
    for content, mime, status in [(b"broken", "image/png", 422), (data, "text/html", 415),
                                  (b"a" * (MAX_UPLOAD_BYTES + 1), "image/png", 413)]:
        assert client.put(photo, content=content, headers={"Content-Type": mime}).status_code == status
        assert client.get(photo).content == fetched.content
    # Streamed/chunked uploads are bounded even without Content-Length.
    assert client.put(photo, content=iter([b"a" * MAX_UPLOAD_BYTES, b"b"]),
                      headers={"Content-Type": "image/png"}).status_code == 413
    other_client, _ = account(app, "09123456780")
    with other_client as other:
        own_family = create(other)
        for path in (photo, f"/api/families/{own_family}/plants/{original['id']}/photo"):
            assert other.get(path).status_code == 404
            assert other.put(path, content=data, headers={"Content-Type": "image/png"}).status_code == 404
            assert other.delete(path).status_code == 404
        assert accept(other, invite(client, family)["token"]).status_code == 200
        replacement = other.put(photo, content=image_bytes(color="red"), headers={"Content-Type": "image/png"})
        assert replacement.status_code == 200
        assert replacement.json()["plant"]["photo_url"] != uploaded["photo_url"]
        assert client.get(photo).content != fetched.content
    command.check(Config("alembic.ini"))
    with pytest.raises(RuntimeError, match="Refusing to discard MinIO photo references"):
        command.downgrade(Config("alembic.ini"), "b36542baf708")
    assert client.delete(photo).status_code == 204
    assert client.delete(photo).status_code == 204
    assert client.get(url).json()["plant"]["photo_url"] is None
    assert client.get(photo).status_code == 404
    assert client.put(photo, content=data, headers={"Content-Type": "image/png"}).status_code == 200
    assert client.delete(url).status_code == 204
    assert client.get(photo).status_code == 404
    assert client.put(photo, content=data, headers={"Content-Type": "image/png"}).status_code == 404
    with Session(app.state.engine) as db:
        deleted = db.scalar(select(Plant).where(Plant.id == UUID(original["id"])))
        assert deleted.photo_key is None and deleted.photo_digest is None
    assert store.data == {}
    command.downgrade(Config("alembic.ini"), "b36542baf708")
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))


def test_storage_outages_preserve_pointer_and_cleanup_recovers(client, app, store):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{row['id']}"
    photo = url + "/photo"
    first = client.put(photo, content=image_bytes(), headers={"Content-Type": "image/png"}).json()
    original = client.get(photo).content
    store.fail.add("put")
    assert client.put(photo, content=image_bytes(color="red"), headers={"Content-Type": "image/png"}).status_code == 503
    assert client.get(url).json()["plant"] == first["plant"]
    assert client.get(photo).content == original
    store.fail.clear()
    store.fail.add("get")
    assert client.get(photo).status_code == 503
    store.fail.clear()
    # Failed/ambiguous uploads remain private; reconciliation only removes objects
    # whose database reference is absent, after a 24-hour grace period.
    assert len(store.data) == 2
    assert cleanup(app.state.sessions, store, apply=True) == {"candidates": 0, "removed": 0}
    future = datetime.now(UTC) + timedelta(hours=25)
    assert cleanup(app.state.sessions, store, at=future) == {"candidates": 1, "removed": 0}
    assert cleanup(app.state.sessions, store, at=future, apply=True) == {"candidates": 1, "removed": 1}
    assert client.get(photo).content == original
    store.fail.add("remove")
    # Removal of the database reference commits even if object deletion is offline.
    assert client.delete(photo).status_code == 204
    assert client.get(photo).status_code == 404
    assert len(store.data) == 1
    store.fail.clear()
    assert cleanup(app.state.sessions, store, at=future, apply=True)["removed"] == 1
    assert not store.data


def test_failed_database_write_keeps_previous_object(client, app, store, monkeypatch):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{row['id']}"
    photo = url + "/photo"
    client.put(photo, content=image_bytes(), headers={"Content-Type": "image/png"})
    original = client.get(photo).content
    flush = Session.flush

    def fail_photo_flush(db, *args, **kwargs):
        if any(isinstance(item, Plant) and item in db.dirty for item in db.identity_map.values()):
            raise RuntimeError("Simulated database failure")
        return flush(db, *args, **kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(Session, "flush", fail_photo_flush)
        with pytest.raises(RuntimeError, match="Simulated database failure"):
            client.put(photo, content=image_bytes(color="red"), headers={"Content-Type": "image/png"})
    assert client.get(photo).content == original
    assert len(store.data) == 2
    future = datetime.now(UTC) + timedelta(hours=25)
    assert cleanup(app.state.sessions, store, at=future, apply=True)["removed"] == 1
    assert client.get(photo).content == original


def test_photos_require_authentication(client):
    photo = "/api/families/00000000-0000-0000-0000-000000000001/plants/00000000-0000-0000-0000-000000000002/photo"
    assert client.get(photo).status_code == 401
    assert client.put(photo, content=image_bytes(), headers={"Content-Type": "image/png"}).status_code == 401
    assert client.delete(photo).status_code == 401


def test_minio_migration_refuses_unexpected_legacy_images(client, app):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    config = Config("alembic.ini")
    command.downgrade(config, "c47653cb0819")
    with app.state.engine.begin() as db:
        db.execute(text("UPDATE plants.plants SET photo_data = :data, photo_digest = :digest WHERE id = :id"),
                   {"data": b"legacy photo", "digest": "a" * 64, "id": UUID(row["id"])})
    with pytest.raises(RuntimeError, match="Refusing to discard existing plant photos"):
        command.upgrade(config, "head")
    with app.state.engine.begin() as db:
        assert db.scalar(text("SELECT photo_data FROM plants.plants WHERE id = :id"),
                         {"id": UUID(row["id"])}) == b"legacy photo"
        db.execute(text("UPDATE plants.plants SET photo_data = NULL, photo_digest = NULL"))
    command.upgrade(config, "head")
    command.check(config)
