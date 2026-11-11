# Personal prepaid wallet

Each user has a private logical wallet starting at zero, persisted on its first monetary operation. It is separate from family cash accounts and their income/expenses. Currency is whole tomans; only the Zarinpal adapter converts to rials (multiply by 10). There are no withdrawals, transfers or client/admin arbitrary credit endpoints. Existing users receive no fabricated opening credit.

## Deployment

1. Run `uv run alembic upgrade head` from `backend/` (migration `bc854329da01`).
2. Set `MABAN_PAYMENT_MERCHANT_ID` and `MABAN_PAYMENT_CALLBACK_URL` together. The callback is the public backend's HTTPS `/api/wallet/callback`, routed to FastAPI. The first `MABAN_ALLOWED_ORIGINS` entry is the frontend destination for `/wallet` redirects. Keep this origin stable while payments are pending.
3. Set `MABAN_SMS_PRICE_TOMAN` to your actual positive, whole-toman price per reminder SMS request in both API and SMS worker. No tariff is assumed by default. Production reminder enablement requires a tariff, separate approved SMS template and existing SMS settings. OTP is always platform-funded.
4. Deploy frontend 1.9.0/backend 3.5.0 together. Restart the worker with the same configuration. Supervise `uv run python -m app.sms_worker` as before.

Without payment credentials, reads work and charging is disabled. Local/test environments never send real SMS. Zarinpal is a real-money adapter, without a simulated credit route; test it with a fake gateway/HTTP transport in automated tests. Do not put real merchant credentials into local development. No live payment or real SMS is required to run tests.

## Payment contract

- Authenticated `GET /api/wallet` returns balance, tariff and gateway availability.
- `GET /api/wallet/entries` and `/api/wallet/topups` return owner-only histories (50 rows and `has_more`, with nonnegative `offset`).
- `POST /api/wallet/topups` accepts `{request_id: UUID, amount_toman: integer}` between 10,000 and 10,000,000 tomans. Reuse the UUID after connection errors; a changed amount with the same UUID is rejected. At most five new pending payment requests per user in a rolling day. Existing retries remain available.
- `POST /api/wallet/topups/{id}/verify` permits only that payment's owner to retry server-side verification. Successful verification adds exactly one credit, including after a provider verification succeeded but a database commit failed. Concurrent callbacks/retries lock the receipt and wallet; credits cannot be duplicated.
- Public `GET /api/wallet/callback?Authority=...&Status=...` verifies the stored authority and stored amount with Zarinpal before crediting. Browser status/redirect query strings are never financial proof. Callback failure/cancellation leaves the payment unconfirmed, with verification available from history. Unconfirmed does not imply a debit or a definitive failure.
- Provider timeouts, malformed/oversized responses and rejections return sanitized errors, without redirects or automatic request retries. A failed initialization may leave an unpayable orphan request at the provider; it never credits a wallet. No authority is trusted from the client to choose the amount or wallet owner.

## Reminder billing and recovery

Scheduling locks the reminder, reserves its current price under the owner's wallet lock, and commits the debit, occurrence and SMS job atomically before any external call. Retries use the occurrence UUID; a refunded occurrence cannot be reserved again. A price change affects only new occurrences. Insufficient funds skip that occurrence without creating a job or debit; top-up does not replay skipped occurrences. Recurring reminders continue at the next scheduled occurrence.

Explicit provider rejection, expiration, deletion, revision changes or deactivation before dispatch return the reservation once through a separate immutable credit. Accepted/uncertain sends retain the debit. A crash after claim is treated as uncertain and never automatically resent. This deliberately favors avoiding double sends and overdrafts over automatic financial reconciliation. Support must compare uncertain attempts/jobs with provider records before deciding whether a compensating credit is appropriate; no automatic refund for unknown delivery is offered. The wallet module's internal settlement interface is reserved for confirmed non-delivery. Keep financial records immutable and retain supporting audit evidence.

Previously queued reminder jobs have no wallet reservation and are skipped without debit/refund when dispatched. They are not retroactively billed; schedule new reminders as needed after deployment. Existing reminder API status `skipped` also covers insufficient balance; the wallet screen explains this policy.

Back up the `wallets`, `reminders` and `messaging` schemas together. The wallet migration refuses downgrade while balances, ledger entries or payment receipts would be lost. Do not reset the database to retry a real payment. Reconcile pending receipts with Zarinpal before changing merchant accounts, credentials or deleting payment history. Existing financial/report APIs remain independent of service credit.
