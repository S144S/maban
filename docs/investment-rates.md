# Personal investment rates

Management's expandable **نرخ‌نامه** lists instruments already held by the signed-in user.
Each rate is a positive whole-toman unit price (maximum 1,000,000,000,000),
keyed by the user, investment kind and exact stored symbol. Whitespace is
trimmed at entry; aliases such as BTC and بیت‌کوین are deliberately not inferred.
Rates are private and do not change family balances or recorded purchase prices.

- `GET /api/investments/rates`: grouped holdings, rates, server-recorded timestamps,
  per-instrument values and the current summary, across all holdings, not just one page.
- `PUT /api/investments/rates`: `{kind, symbol, unit_price_toman}`; use an empty
  symbol for metals and `null` price to clear a rate. Only held instruments may be updated.
- `GET /api/investments/current-summary`: exact decimal-string total, holding count,
  missing-rate count and `valuation_basis: manual_unit_rates`.
- Existing `/summary` retains its recorded-purchase-price contract.

No purchase-price fallback is mixed into the current valuation. Missing prices are
excluded and explicitly counted; an entirely unpriced portfolio is shown as unknown.
Timestamps indicate when a user saved the rate, not an independently verified market time.
Rates persist until edited or cleared. No automatic price feed is integrated.

Gold and silver are priced per gram. The existing holding model does not distinguish
purity; each metal has one rate per user, so users must enter a rate matching their
holdings. Mixed purities require a future model extension. Crypto and FX use units,
stocks use shares and bonds use certificates. Sub-toman unit rates are not currently
supported. Run `alembic upgrade head` before serving backend 1.4.0/frontend 0.21.0.

## Property and vehicle rates

The same compact price list also includes each owned property and vehicle. Property
labels include location and title; vehicle labels include brand, model and year.
Rates are scoped to an individual asset ID, never shared by matching address or model.

- `GET /api/assets/rates`: all owned assets with their nullable current unit prices.
- `PUT /api/assets/rates/{asset_id}`: `{unit_price_toman}`; positive whole tomans,
  up to 1,000,000,000,000, or `null` to clear. Other users' assets cannot be changed.
- `GET /api/assets/current-summary`: exact sum of area × rate for properties and
  whole-vehicle prices for cars, with explicit unpriced counts.
- Historical asset create/list/summary contracts remain unchanged. The asset fund
  now displays the current summary without falling back to purchase values.

Run Alembic upgrade head to add the nullable asset rate columns.

## Potential market data sources

Documentation checked on 2026-11-05; no credentials were requested and no paid
subscriptions were created. Access, quotas and redistribution rights must be confirmed
when integrating. Provider documentation is not evidence of an operational SLA.

| Market | Candidate and official reference | Integration considerations |
| --- | --- | --- |
| Iranian FX and gold | [Navasan](https://www.navasan.tech/webserviceguide/) | JSON latest quotes and timestamps; requires a subscription/API key. Confirm instrument, quote unit, buy/sell side and HTTPS availability before use. |
| Global gold and silver | [GoldAPI](https://www.goldapi.io/) | XAU/XAG quotes; distinguish ounce/gram and purity, then convert currency. Global spot is not the Iranian retail price. |
| Crypto in Iranian markets | [Nobitex market stats](https://apidocs.nobitex.ir/market_data/%D8%A2%D9%85%D8%A7%D8%B1-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1) | Public `GET /market/stats` without a token, documented 20 requests/minute. `dstCurrency=rls` is rial, requiring conversion to tomans. Represents that exchange's market. |
| Global crypto | [CoinGecko simple price](https://docs.coingecko.com/reference/simple-price) | Prefer stable coin IDs over ambiguous symbols. Use quote currency and `last_updated_at`; key/quotas depend on plan. A USD quote still needs a separate local FX rate. |
| Iranian stocks | [TSETMC REST documentation](https://api.tsetmc.com/docs/) | REST service announced by the exchange technology company, reported by [Tasnim](https://www.tasnimnews.ir/fa/news/1404/10/06/3481080). Documentation could not be fetched in this review, so authentication, commercial terms and current endpoint details remain unverified. Confirm rial units and distinguish last trade from closing price. |

Future integration should keep provider quotes separate from personal overrides, store
source/instrument/unit/quote timestamp, map stable instrument IDs explicitly, cache on
the backend, keep provider credentials server-side and display stale/missing quotes.
Never silently substitute global spot prices for local market rates or overwrite manual
rates. Stock pricing also needs market-session timestamps, not merely fetch time.
