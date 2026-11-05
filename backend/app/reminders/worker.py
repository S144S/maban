"""Compatibility entry point; use python -m app.sms_worker for the shared worker."""

from app.sms_worker import main

if __name__ == "__main__":
    main()
