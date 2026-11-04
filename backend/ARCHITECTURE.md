# Modular monolith boundaries

One FastAPI deployment and one PostgreSQL database. A schema is an ownership
namespace, not a separate service or a separate runtime security role.

## Module interfaces

`app/users/` owns authentication, account profiles, sessions and administrator
user management. All other business modules may import only `users.public`:
`CurrentUser` supplies a frozen `UserIdentity(id, role)`, never a mutable ORM
entity, database session, password hash or authentication token. Authentication
and revocation remain evaluated by the owning module on each request.

Composition-only entry points are explicit:

- `main.py` calls `users.bootstrap.install` to install routes, SMS adapter and
  module error handling. Business modules cannot use this startup interface.
- `cli.py` dispatches to `users.commands.run`. User administration/cleanup logic
  and SQL remain owned by the users module.
- Alembic imports `users.persistence` to register owned tables. This interface
  is reserved for migration tooling, not domain queries.

Within users, `routes.py` handles HTTP input/output and cookies, `dependencies.py`
handles request transactions/authentication, `service.py` owns application
operations and database queries, `models.py` owns persistence, and `security.py`
contains password/token primitives and SMS adapters. The service currently uses
SQLAlchemy directly inside its own boundary; a speculative repository layer is
not required for modularity. Shared `config.py` and `database.py` contain no
business rules. Test code may inspect internals to verify security invariants.

## Data ownership

All four user tables live in schema `users`: `users`, `user_sessions`,
`user_otp_challenges`, and `user_rate_buckets`. Names remain stable across the
schema move. Session foreign keys stay inside the owning schema. Alembic's
version table stays in `public`, with one ordered migration chain for the
single deployment. Autogeneration includes registered module schemas.

Future modules (for example transactions and budgets) must own their own
schemas, models and migrations in the same migration chain. They must access
users through public application contracts, never by importing its ORM models,
writing its tables, or adding cross-module ORM relationships. Store an opaque
user UUID when required and obtain authorization/existence decisions through
the owning module's interface. New interfaces should be small, typed and
acyclic; cross-domain workflows must coordinate through them.

Schema separation alone does not prevent SQL access with the shared application
DB role. Architectural enforcement is provided by code ownership and import
checks; this is not claimed as PostgreSQL privilege isolation. Migrations and
operator tools are intentionally trusted composition infrastructure.

## Verification

`uv run pytest -q` checks import boundaries, HTTP persistence separation,
immutable public identities, table/schema ownership, real migration round trips
with existing accounts and sessions, and all authentication security flows.
`uv run alembic check` catches metadata/migration drift. Run checks before adding
or changing a module. Runtime dynamic imports and handwritten cross-schema SQL
also require code review; static import tests are not a sandbox.

## Families module

`app/families` owns the `families` schema with `families`, `memberships` and
`invitations` tables. Ownership is distinct from relationship: members with full access
manage invitations, while spouse/child/friend are relationship labels only.
Each user can own one family and join others (maximum 20 memberships, 100 members
per family). The creator has a membership with no relationship label. User IDs
are opaque UUIDs without foreign keys into the users schema.

Families depends only on `users.public.CurrentUser` and `Directory`. After
family-level authorization, Directory supplies immutable `UserProfile` values
containing only ID and names (100 maximum), never phones or credentials.
Dependency direction is families -> users; users does not depend on families.
Family HTTP handlers contain no persistence queries. Composition registers the
family router through `families.bootstrap`; migration metadata is exported by
`families.persistence`. `families.public.Access` provides read/write authorization and membership validation without exposing ORM state.

Invitation creation requires full access, limited to 20 links per family per hour.
Each random 256-bit token is stored as a SHA-256 digest and returned once.
Links expire after seven days, can be revoked, and are accepted explicitly by
an authenticated active user. Possession of a link grants its bearer the ability
to accept it first; links are not bound to a phone number. Existing members and
the owner cannot consume them. Concurrent acceptance/revocation is serialized
per family; membership creation is also serialized per user. Repeated acceptance
by the winning user is idempotent while the invite is valid.

Tokens travel in URL fragments (`/invite#token=...`, `/login#invite=...`) and
POST bodies, never API paths/query strings. Do not log bodies containing secrets.
The frontend only accepts validated invitation tokens and allowlisted auth return
paths. Family names and member names are visible only to family members; valid
invite holders can preview the family name and their relationship after login.
No transaction/budget data is shared by this module yet. Membership removal,
family deletion/transfer and relationship edits are not exposed in this version.

## Income module

`app/income` owns `income.entries`. It depends on public families authorization, users identity/directory and
money_locations lookup contracts. Family and user
IDs are opaque references without cross-schema foreign keys. Full-access members
can record income; all family members can read their family inbox. Attribution
must refer to a current member of the same family.

All monetary values in MaBan are whole tomans, never rials. Each income entry
has a positive integer `amount_toman` (maximum 1,000,000,000,000), a source
(`salary`, `subsidy`, `voucher`, `gift`), a member ID and optional description.
The inbox total includes vouchers and is an income total, not a cash balance.
Totals are serialized as decimal strings to preserve precision in JavaScript.
GET `/api/families/{id}/income` returns up to 50 entries with offset pagination.
POST requires a UUID `request_id`: identical retries return the original entry;
reusing a key with different data returns 409. No edit/delete endpoints exist yet.
Run Alembic upgrade head to create the schema.

## Expenses module and home balance

`app/expenses` owns `expenses.entries` and depends only on families/public
authorization and users/public identity contracts. It never accesses income
persistence. Entries store a positive whole-toman amount, title, category,
current family member attribution and optional description. Full-access members
can write; all family members can read. Family/request uniqueness makes retries
idempotent. GET/POST `/api/families/{id}/expenses` use the same pagination and
precision-preserving aggregate conventions as income. No edit/delete API is exposed.

Home reads the selected family's income and expense aggregates through their
HTTP APIs and subtracts using BigInt. This is a recorded net balance, including
vouchers, not a bank account balance. The two reads are refreshed after writes,
on mounting and on window focus; they are not a cross-module transactional snapshot.
No family is created implicitly. The transaction preview does not
write to this balance. Run Alembic upgrade head before starting the new API.

## Money locations module

`app/money_locations` owns `money_locations.locations` in a separate PostgreSQL
schema. It uses only the public family access and user identity interfaces.
`money_locations.public.Directory` resolves a same-family location to its name;
income calls this contract and stores the opaque ID and name snapshot. There are
no cross-schema foreign keys or imports of another module's persistence.
Names are unique per family. Full-access members create locations, all members
may list them, and outsiders receive 404. Full-access members may rename accounts
via PATCH on the account ID; family name uniqueness remains enforced. Income
keeps the original name snapshot and stable account ID. Deletion sets deleted_at on the account without changing any income records.
Active lists and new income lookups exclude deleted accounts; existing income
retries remain valid. Deleted names remain reserved within the family.
The migration adds nullable income columns, preserving old records and legacy
API clients. Current UI forms require a location for new income entries.


### Personal investments

The investments module owns `investments.entries`. Authenticated users can POST and GET
`/api/investments`; ownership is derived exclusively from the current session. Family
membership does not grant access to these personal records. Gold quantities use exact
NUMERIC(10,3) grams (0.001–1,000,000); optional unit and total purchase prices are independent,
positive whole-toman amounts up to 1,000,000,000,000. No price is inferred automatically.
Creation is idempotent per user/request UUID; history is paginated with `offset` (50 per page).
Investments do not change income, expenses or family cash balances. Apply `alembic upgrade head`
before running the new API. Downgrading this migration removes all investment records.
