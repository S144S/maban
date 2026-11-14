# Family prepaid wallet

Each family has a shared logical wallet starting at zero, persisted on its first monetary operation. It is separate from family cash accounts and their income/expenses. Currency is whole tomans; only the Zarinpal adapter converts to rials (multiply by 10). There are no withdrawals, transfers or client/admin arbitrary credit endpoints. Existing users receive no fabricated opening credit.

## Deployment

1. Run `uv run alembic upgrade head` from `backend/` (through migration `e8da512fc940`; see the attribution steps below before upgrading an existing wallet database).
2. Set `MABAN_PAYMENT_MERCHANT_ID` and `MABAN_PAYMENT_CALLBACK_URL` together. The callback is the public backend's HTTPS `/api/wallet/callback`, routed to FastAPI. The first `MABAN_ALLOWED_ORIGINS` entry is the frontend destination for `/wallet` redirects. Keep this origin stable while payments are pending.
3. Replace the obsolete `MABAN_SMS_PRICE_TOMAN` setting with `MABAN_SMS_REMINDER_BODY`: the exact approved provider pattern text, preserving whitespace, punctuation, branding and any provider-added suffix. Use plain `{title}`, `{date}`, `{time}` and `{amount}` placeholders for its variables (escape literal braces as `{{` / `}}`). Both API and worker must use matching body and pattern code; enablement fails without a valid body. Do not guess the template text. When changing a provider template, use a new pattern code and retain the old code until queued jobs complete. OTP is always platform-funded.
4. Deploy frontend 1.12.0/backend 5.2.0 together. Restart the worker with the same configuration. Supervise `uv run python -m app.sms_worker` as before.

Without payment credentials, reads work and charging is disabled. Local/test environments never send real SMS. Zarinpal is a real-money adapter, without a simulated credit route; test it with a fake gateway/HTTP transport in automated tests. Do not put real merchant credentials into local development. No live payment or real SMS is required to run tests.

## Registration gifts

Successful new registrations create a wallet-owned gift entitlement in the same database transaction. On their first family creation or invitation acceptance, the member contributes 5,000 tomans to that family's shared wallet, including the family creator. Registration before joining a family retains an unclaimed entitlement. The credit is immediately spendable for SMS and appears as `signup_gift` in the immutable ledger, with the registered user UUID as its unique reference. No withdrawal or transfer is available.

The entitlement row is locked before the wallet, and membership, credit and claim commit together. Failed membership and transaction rollbacks do not consume the gift. Retried invitations and joining/creating subsequent families cannot generate another gift. Existing registrations receive no retroactive entitlements or credit during migration. Migration downgrade refuses to discard pending or claimed entitlements; restore a backup for rollback.

## Payment contract

- Authenticated `GET /api/families/{family_id}/wallet` returns balance, `sms_persian_part_toman` (500), `sms_english_part_toman` (750), and gateway availability. Backend 4.0.0 removes the old flat `sms_price_toman`; update clients together.
- `GET /api/families/{family_id}/wallet/entries` and `/api/families/{family_id}/wallet/topups` return family-member histories (50 rows and `has_more`, with nonnegative `offset`).
- `POST /api/families/{family_id}/wallet/topups` accepts `{request_id: UUID, amount_toman: integer}` between 10,000 and 10,000,000 tomans. Reuse the UUID after connection errors; a changed amount with the same UUID is rejected. At most five new pending payment requests per family in a rolling day. Existing retries remain available.
- `POST /api/families/{family_id}/wallet/topups/{id}/verify` permits any current member of that payment's family to retry server-side verification. Successful verification adds exactly one credit, including after a provider verification succeeded but a database commit failed. Concurrent callbacks/retries lock the receipt and wallet; credits cannot be duplicated.
- Public `GET /api/wallet/callback?Authority=...&Status=...` verifies the stored authority and stored amount with Zarinpal before crediting. Browser status/redirect query strings are never financial proof. Callback failure/cancellation leaves the payment unconfirmed, with verification available from history. Unconfirmed does not imply a debit or a definitive failure.
- Provider timeouts, malformed/oversized responses and rejections return sanitized errors, without redirects or automatic request retries. A failed initialization may leave an unpayable orphan request at the provider; it never credits a wallet. No authority is trusted from the client to choose the amount or wallet owner.

## Reminder billing and recovery

Reminder authors may choose up to 99 additional `recipient_user_ids` from the paying family. The author always receives their own SMS. Only the author can list, edit or delete the reminder; selecting a member shares the pattern's title, due date/time and amount by SMS, never the private note. The form automatically submits the active family's wallet for new reminders (falling back to the first accessible family) and retains an existing reminder's accessible wallet. It has no wallet selector. A change in the resolved family clears recipient selections. Without a family, reminders remain available in-app without SMS. Older API clients omitting the recipient field preserve existing selections on updates; no additional selection keeps prior behavior.

Each recipient has an independent attempt, queue job, debit and refund. The author is reserved first, followed by the normalized recipient order; low balance may skip later recipients without overdraft. Membership and active accounts are checked at scheduling and again before dispatch. Removed/deactivated members are skipped; recipient edits invalidate previously queued sends and refund confirmed cancellations without replaying past occurrences. Rejection refunds only that recipient; uncertain sends retain only their own reservation. Aggregate status is unknown if any outcome is uncertain, otherwise skipped if any recipient was skipped, and accepted only when all were accepted. Migration `e8da512fc940` attributes all historical attempts to their original author; downgrade refuses to drop selected recipients or non-author delivery history.

The server matches the supplied JavaScript algorithm exactly: characters with code units greater than 128 select the Persian rate (including mixed text, accents and emoji). Other text selects English. Count UTF-16 units, including two for emoji. Single-part limits are 70 / 160; first calculate `ceil(length / limit)`, add 4 / 7 units per preliminary part only when more than one, then recalculate the ceiling (minimum one part). Persian costs 500 tomans per resulting part, English 750. Thus 70 Persian units cost 500, 71 cost 1,000; 160 English units cost 750, 161 cost 1,500. The pure counter also supports the supplied optional default-character count, which forces the 70/4 branch even when zero; production bills the fully rendered text without that approximation.

Scheduling locks the reminder, renders the complete approved pattern with its occurrence attributes, reserves its calculated price under the explicitly selected family wallet lock, and commits the debit, occurrence and SMS job atomically before any external call. Retries use the occurrence UUID; a refunded occurrence cannot be reserved again. The encrypted queued job retains the priced pattern code and attributes, so configuration changes cannot alter an already reserved send. Existing ledger prices are never recalculated. Insufficient funds skip that occurrence without creating a job or debit; top-up does not replay skipped occurrences. Recurring reminders continue at the next scheduled occurrence.

Explicit provider rejection, expiration, deletion, revision changes or deactivation before dispatch return the reservation once through a separate immutable credit. Accepted/uncertain sends retain the debit. A crash after claim is treated as uncertain and never automatically resent. This deliberately favors avoiding double sends and overdrafts over automatic financial reconciliation. Support must compare uncertain attempts/jobs with provider records before deciding whether a compensating credit is appropriate; no automatic refund for unknown delivery is offered. The wallet module's internal settlement interface is reserved for confirmed non-delivery. Keep financial records immutable and retain supporting audit evidence.

Previously queued reminder jobs without a priced pattern/attributes snapshot are skipped; any existing reservation is refunded once. Jobs without a reservation are skipped without debit/refund. They are not retroactively billed; schedule new reminders as needed after deployment. Existing reminder API status `skipped` also covers insufficient balance; the wallet screen explains this policy.

Back up the `wallets`, `wallets_legacy`, `reminders` and `messaging` schemas together. The wallet migration refuses downgrade while balances, ledger entries or payment receipts would be lost. Do not reset the database to retry a real payment. Reconcile pending receipts with Zarinpal before changing merchant accounts, credentials or deleting payment history. Existing financial/report APIs remain independent of service credit.


## Family ownership migration (backend 5.0.0)

Stop the old API and worker and back up first. No family is inferred from the user's first membership, ownership or active UI selection. On a database with personal financial records, explicitly attribute each personal wallet to a family where that user is a member:

```sql
CREATE TABLE IF NOT EXISTS wallets.ownership_migration (
    user_id uuid PRIMARY KEY, family_id uuid NOT NULL
);
-- Populate reviewed user/family UUID pairs before running alembic upgrade head:
-- INSERT INTO wallets.ownership_migration (user_id, family_id) VALUES ('...', '...');
```

An empty installation needs no mapping. An unmapped nonzero account, ledger or receipt aborts the migration transaction; resolve it before deployment. Existing pending receipts must also have an assigned family so later callbacks credit that exact family. Do not assign money without reviewing its intended destination. Multiple personal accounts may map into one family: balances sum and the new family ledger recomputes running balances. Original accounts, receipts and per-user ledger snapshots remain unchanged in `wallets_legacy` for audit. Reused request UUIDs that collide within a target family or inconsistent ledger ordering/balances abort the transaction and require reconciliation rather than silently discarding evidence. Never edit published ledger entries to force migration success.

Existing reminders remain private and start with no SMS-paying family; edit them to select `sms_family_id` explicitly. They remain visible in-app without SMS. Membership is checked on create/update, scheduling and dispatch. Removing membership prevents subsequent sends; cancelled queued jobs refund the original family by debit reference. Switching the billing family cancels stale queued sends without replaying completed occurrences. Existing queued revisions are invalidated on migration and refunded by the normal worker settlement path. A refund never follows the author's current family selection. The public callback path stays `/api/wallet/callback`; its redirect includes the stored family UUID. All other personal `/api/wallet` endpoints are removed in 5.0.0.
