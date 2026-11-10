from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from typing import Protocol

import urllib3
from minio import Minio
from minio.error import MinioException, S3Error

from app.plants.errors import PlantError
from app.plants.photos import MAX_UPLOAD_BYTES


@dataclass(frozen=True)
class StoredPhoto:
    key: str
    modified_at: datetime


class PhotoStorage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def get(self, key: str) -> bytes: ...
    def remove(self, key: str) -> None: ...
    def objects(self) -> Iterator[StoredPhoto]: ...


class MinioPhotos:
    def __init__(self, settings):
        self.bucket = settings.minio_bucket
        self.client = Minio(settings.minio_endpoint,
            access_key=settings.minio_access_key, secret_key=settings.minio_secret_key,
            secure=settings.minio_secure, region="us-east-1",
            http_client=urllib3.PoolManager(timeout=urllib3.Timeout(connect=3, read=8), retries=False),
        ) if settings.minio_endpoint else None

    @contextmanager
    def operation(self):
        if self.client is None:
            raise PlantError("ذخیره‌سازی عکس هنوز تنظیم نشده؛ با پشتیبانی هماهنگ کنین.", 503)
        try:
            yield self.client
        except S3Error as error:
            if error.code in {"NoSuchKey", "NoSuchObject"}:
                raise PlantError("عکس گلدون پیدا نشد؛ می‌تونین عکس تازه‌ای بذارین.", 404) from error
            raise PlantError("ذخیره‌سازی عکس در دسترس نیست؛ کمی بعد دوباره امتحان کنین.", 503) from error
        except (MinioException, urllib3.exceptions.HTTPError, OSError) as error:
            raise PlantError("ذخیره‌سازی عکس در دسترس نیست؛ کمی بعد دوباره امتحان کنین.", 503) from error

    def setup(self):
        """Explicit operator action, never called on app startup or ordinary requests."""
        with self.operation() as client:
            if not client.bucket_exists(self.bucket):
                client.make_bucket(self.bucket)
            try:
                client.get_bucket_policy(self.bucket)
            except S3Error as error:
                if error.code != "NoSuchBucketPolicy":
                    raise
            else:
                raise RuntimeError("Plant bucket must be private and have no anonymous bucket policy")

    def put(self, key, data):
        with self.operation() as client:
            client.put_object(self.bucket, key, BytesIO(data), len(data), content_type="image/jpeg")

    def get(self, key):
        with self.operation() as client:
            response = client.get_object(self.bucket, key)
            try:
                data = response.read(MAX_UPLOAD_BYTES + 1)
                if len(data) > MAX_UPLOAD_BYTES:
                    raise PlantError("عکس ذخیره‌شده معتبر نیست؛ یه عکس تازه بذارین.", 503)
                return data
            finally:
                response.close()
                response.release_conn()

    def remove(self, key):
        with self.operation() as client:
            client.remove_object(self.bucket, key)

    def objects(self):
        with self.operation() as client:
            for obj in client.list_objects(self.bucket, prefix="plants/", recursive=True):
                if obj.last_modified is not None:
                    yield StoredPhoto(obj.object_name, obj.last_modified)


if __name__ == "__main__":
    from app.config import Settings

    MinioPhotos(Settings()).setup()
    print("Private plant photo bucket is ready")
