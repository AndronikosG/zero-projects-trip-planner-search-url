# Search URL Contract

**Status:** Contract-first specification. Implementation must follow this document.

## Goals

1. **100% shared-link fidelity:** a shared search URL must rebuild one deterministic normalized search state and preserve the same result identity for the recipient.
2. **Zero redundant search requests on repeat navigation:** revisiting an already-fetched normalized search in the current session must issue **0** additional search endpoint requests.

---

## Search screen and URL ownership

```text
┌─────────────────────────────────────────────────────────────┐
│ FILTER PANEL — owns canonical search state                  │
│ Destination [ Lisbon ]                         → dest        │
│ Check-in [ 2025-02-06 ]                       → checkin     │
│ Check-out [ 2025-02-09 ]                      → checkout    │
│ Guests [ 2 ]                                  → guests      │
│ Rooms [ 1 ]                                   → rooms       │
│ Maximum price / night [ 180 ]                 → maxprice    │
├─────────────────────────────────────────────────────────────┤
│ SHARED URL STRIP — owns canonical serialization             │
│ ?dest=Lisbon&checkin=2025-02-06&checkout=2025-02-09&        │
│ guests=2&rooms=1&maxprice=180                 [ Copy link ] │
├─────────────────────────────────────────────────────────────┤
│ RESULTS LIST — owned by normalized TanStack Query key       │
│ Lisbon Central Hotel · €142/night · 8.7                     │
│ Alfama Garden Rooms · €118/night · 9.1                      │
│ Riverside Apartment · €176/night · 8.4                      │
└─────────────────────────────────────────────────────────────┘
```

The filter panel writes canonical state. The URL strip serializes only normalized canonical values. The results list is fetched with a TanStack Query key derived from those same normalized values.

---

## Parameter contract

| Query key | Role | Type after decode | Allowed format / boundary | Default | Degradation / fallback rule |
|---|---|---|---|---|---|
| `dest` | Canonical destination | `string` | Trimmed text, 1–100 chars | `"anywhere"` | Missing, blank, or over 100 chars → `"anywhere"`. `"anywhere"` is the explicit routable no-destination state, not an inferred city. |
| `ss` | Legacy destination alias | `string` | Same as `dest` | — | Used when valid `dest` is absent. |
| `city` | Legacy destination alias | `string` | Same as `dest` | — | Used after `dest` and `ss`. |
| `destination` | Legacy destination alias | `string` | Same as `dest` | — | Used after `dest`, `ss`, and `city`. |
| `checkin` | Canonical check-in | `string` | Real calendar date serialized as `YYYY-MM-DD` | `2025-01-01` | If check-in is invalid/missing but checkout parses to a real date, recover check-in as exactly **checkout - 1 calendar day**. Otherwise use `2025-01-01`. This is why `checkin=2024-13-45&checkout=2025-09-1` becomes `checkin=2025-08-31&checkout=2025-09-01`. |
| `checkin_monthday` | Legacy check-in day | decoder-only | Integer day | — | Combined with legacy month/year only when all three form a real date. |
| `checkin_month` | Legacy check-in month | decoder-only | Integer 1–12 | — | Combined with legacy day/year. |
| `checkin_year` | Legacy check-in year | decoder-only | Four-digit year | — | Combined with legacy day/month. |
| `checkout` | Canonical check-out | `string` | Real date, strictly later than check-in; serialized as `YYYY-MM-DD` | `checkin + 1 day` | Missing, invalid, equal to, or earlier than check-in → check-in + 1 day. A valid relaxed form such as `2025-09-1` is normalized to `2025-09-01`. |
| `guests` | Canonical guest count | `number` | Integer 1–10 | `2` | Missing/non-numeric → `2`; <1 clamps to 1; >10 clamps to 10. |
| `group_adults` | Legacy guests alias | `number` | Same as `guests` | — | Used when canonical `guests` is absent/invalid. |
| `adults` | Legacy guests alias | `number` | Same as `guests` | — | Used after `guests` and `group_adults`. |
| `rooms` | Canonical room count | `number` | Integer 1–5 | `1` | Missing/non-numeric → `1`; <1 clamps to 1; >5 clamps to 5. |
| `no_rooms` | Legacy rooms alias | `number` | Same as `rooms` | — | Used when canonical `rooms` is absent/invalid. |
| `maxprice` | Canonical nightly cap | `number \| undefined` | Integer 1–1000 | `undefined` = no cap | Missing/empty/non-numeric → `undefined`; numeric <1 clamps to 1; numeric >1000 clamps to 1000. |
| `price_max` | Legacy price alias | `number \| undefined` | Same as `maxprice` | — | Used when canonical `maxprice` is absent/invalid. |
| `maxPrice` | Legacy price alias | `number \| undefined` | Same as `maxprice` | — | Used after `maxprice` and `price_max`. |
| `budget` | Legacy price alias | `number \| undefined` | Same as `maxprice` | — | Used after the other price aliases. |

Alias precedence is deterministic:

```text
destination: dest → ss → city → destination → "anywhere"
check-in:    checkin → split legacy date → checkout - 1 day → 2025-01-01
guests:      guests → group_adults → adults → 2
rooms:       rooms → no_rooms → 1
price:       maxprice → price_max → maxPrice → budget → undefined
```

Canonical keys are emitted by new links. Legacy names are decoder-only compatibility inputs.

---

## Unknown parameter rule

Any query key outside the recognized keys above is **dropped completely**. Examples from the capture log are `order`, `sortBy`, `offset`, `nflt`, `utm_source`, `label`, and `aid`.

Unknown values do not enter search state, validation, canonical URLs, or TanStack Query keys.

---

## Normalized search state

```ts
type SearchState = {
  dest: string;
  checkin: string;
  checkout: string;
  guests: number;
  rooms: number;
  maxprice?: number;
};
```

Normalization happens before serialization and before cache-key construction. Destination whitespace is trimmed and collapsed. Dates are serialized as `YYYY-MM-DD`. Numeric fields are integers inside their ranges. The `"anywhere"` destination default is deliberately part of canonical state so a link with no usable destination still has one deterministic, routable identity.

---

## Canonical URL serialization

Canonical links use this exact order:

```text
dest → checkin → checkout → guests → rooms → maxprice
```

Example:

```text
?dest=Lisbon&checkin=2025-02-06&checkout=2025-02-09&guests=2&rooms=1&maxprice=180
```

`maxprice` is omitted when undefined. Legacy and unknown keys are never emitted.

---

## TanStack Query cache-key contract

The cache key is derived from normalized state, never the raw URL:

```ts
[
  "accommodation-search",
  normalized.dest.toLowerCase(),
  normalized.checkin,
  normalized.checkout,
  normalized.guests,
  normalized.rooms,
  normalized.maxprice ?? null,
]
```

Exact order:

```text
namespace → dest → checkin → checkout → guests → rooms → maxprice
```

This means legacy and canonical links that normalize to the same state resolve to the same cache entry.

---

## Capture-log degradation examples

| Capture | Input issue | Normalized behavior |
|---|---|---|
| `SL-0107` | Valid values with historical `ss`, `group_adults`, `no_rooms` names | Values map directly into canonical state; unrelated keys are dropped. |
| `SL-0104` | Split legacy check-in fields, `adults`, `price_max` | Split fields produce `2025-02-22`; checkout falls back to `2025-02-23`; aliases map to canonical fields. |
| `SL-0112` | Missing checkout/rooms and `maxPrice=-50` | Checkout → `2025-08-03`; rooms → `1`; maxprice clamps to `1`. |
| `SL-0180` | `maxPrice=9999999` | Maxprice clamps to `1000`. |
| `SL-0142` | Impossible check-in, relaxed checkout, non-numeric adults | Checkout normalizes to `2025-09-01`; check-in → `2025-08-31`; guests → `2`. |

---

## Acceptance targets

### Shared-link fidelity
**Target: 100%.** A valid or recoverable shared link must decode to one deterministic normalized state, and encoding that state must produce one canonical link.

### Repeat-navigation caching
**Target: 0 redundant search requests.** Revisiting an already-fetched normalized state in the current session must resolve from TanStack Query cache without a new endpoint request.

Equivalent target:

```text
repeat-navigation cache hit rate = 100%
new endpoint requests for that repeat = 0
```

---

## Implementation boundary

Schema, decoder, encoder, page URL state, tests, and cache-key construction must follow this contract. Changes to aliases, defaults, validation, serialization, or cache-key shape require updating this contract first.
