import os
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
import urllib3
from minio.error import S3Error
from pydantic import ValidationError
from test_families import create
from test_plant_photos import image_bytes
from test_plants import payload
from test_users import register

from app.config import Settings
from app.plants.errors import PlantError
from app.plants.storage import MinioPhotos


def settings(**changes):
    return SimpleNamespace(minio_endpoint="127.0.0.1:54340", minio_access_key="maban_local",
        minio_secret_key="maban_minio_local_only", minio_bucket="maban-test-" + uuid4().hex,
        minio_secure=False, **changes)


def s3error(code):
    return S3Error(code=code, message="private diagnostic", resource="resource", request_id="request",
                   host_id="host", response=None)


def test_storage_errors_are_sanitized_and_connections_closed():
    store = MinioPhotos(settings())
    sdk = store.client = MagicMock()
    response = sdk.get_object.return_value
    response.read.return_value = b"jpeg"
    assert store.get("plants/key.jpg") == b"jpeg"
    response.close.assert_called_once()
    response.release_conn.assert_called_once()
    response.read.side_effect = urllib3.exceptions.ReadTimeoutError(None, "private-host", "private key")
    with pytest.raises(PlantError) as error:
        store.get("plants/key.jpg")
    assert error.value.status == 503 and "private" not in error.value.message
    assert response.close.call_count == 2 and response.release_conn.call_count == 2
    sdk.put_object.side_effect = s3error("AccessDenied")
    with pytest.raises(PlantError) as error:
        store.put("plants/key.jpg", b"jpeg")
    assert error.value.status == 503 and "private" not in error.value.message
    sdk.get_object.side_effect = s3error("NoSuchKey")
    with pytest.raises(PlantError) as error:
        store.get("plants/key.jpg")
    assert error.value.status == 404
    # The bucket must not be anonymous/public. Setup never overwrites its policy.
    sdk.get_bucket_policy.return_value = '{"Statement": ["public"]}'
    with pytest.raises(RuntimeError, match="private"):
        store.setup()
    sdk.set_bucket_policy.assert_not_called()


def test_disabled_photo_storage_does_not_fall_back_to_database(client, app):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    config = settings()
    config.minio_endpoint = ""
    app.state.plant_photos = MinioPhotos(config)
    url = f"{base}/{row['id']}"
    response = client.put(url + "/photo", content=image_bytes(), headers={"Content-Type": "image/png"})
    assert response.status_code == 503
    assert client.get(url).json()["plant"]["photo_url"] is None


def test_storage_config_rejects_partial_settings():
    config = {"environment": "test", "database_url": "postgresql+psycopg://unused/unused_test",
              "secret_key": "test-secret-" + "x" * 40, "minio_endpoint": "",
              "minio_access_key": "", "minio_secret_key": ""}
    with pytest.raises(ValidationError, match="together"):
        Settings(**{**config, "minio_endpoint": "127.0.0.1:54340"})
    with pytest.raises(ValidationError, match="without scheme"):
        Settings(**{**config, "minio_endpoint": "http://127.0.0.1:54340", "minio_access_key": "a", "minio_secret_key": "b"})


@pytest.mark.skipif(not os.getenv("MABAN_TEST_MINIO_ENDPOINT"), reason="Set MABAN_TEST_MINIO_* for real MinIO integration")
def test_real_minio_private_api_flow(client, app):
    config = settings()
    config.minio_endpoint = os.environ["MABAN_TEST_MINIO_ENDPOINT"]
    config.minio_access_key = os.environ["MABAN_TEST_MINIO_ACCESS_KEY"]
    config.minio_secret_key = os.environ["MABAN_TEST_MINIO_SECRET_KEY"]
    config.minio_secure = os.getenv("MABAN_TEST_MINIO_SECURE", "false").lower() == "true"
    store = MinioPhotos(config)
    store.setup()
    app.state.plant_photos = store
    try:
        register(client)
        base = f"/api/families/{create(client)}/plants"
        row = client.post(base, json=payload()).json()["plant"]
        photo = f"{base}/{row['id']}/photo"
        data = image_bytes()
        response = client.put(photo, content=data, headers={"Content-Type": "image/png"})
        assert response.status_code == 200, response.text
        fetched = client.get(response.json()["plant"]["photo_url"])
        assert fetched.content.startswith(b"\xff\xd8") and fetched.headers["content-type"] == "image/jpeg"
        objects = list(store.objects())
        assert len(objects) == 1
        old_key = objects[0].key
        scheme = "https" if config.minio_secure else "http"
        anonymous = httpx.get(f"{scheme}://{config.minio_endpoint}/{config.minio_bucket}/{old_key}", trust_env=False)
        assert anonymous.status_code == 403
        # Repeated upload retains exactly one object; replacing it removes the old.
        assert client.put(photo, content=data, headers={"Content-Type": "image/png"}).status_code == 200
        assert len(list(store.objects())) == 1
        assert client.put(photo, content=image_bytes(color="red"), headers={"Content-Type": "image/png"}).status_code == 200
        assert len(list(store.objects())) == 1 and next(iter(store.objects())).key != old_key
        with pytest.raises(PlantError) as error:
            store.get(old_key)
        assert error.value.status == 404
        assert client.delete(photo).status_code == 204
        assert client.get(photo).status_code == 404
        assert list(store.objects()) == []
    finally:
        # Only this test's random, dedicated bucket is touched.
        for obj in store.objects():
            store.remove(obj.key)
        store.client.remove_bucket(store.bucket)
