import base64
import hashlib

from cryptography.fernet import Fernet


def payload_cipher(secret_key: str) -> Fernet:
    key = hashlib.sha256(b"maban:sms-job:v1:" + secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))
