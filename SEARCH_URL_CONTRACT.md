# Search URL Contract

**Status:** Contract-first specification. This document must be committed before implementation of the shareable Search URL layer.

## Goals

1. **100% shared-link fidelity:** opening a valid or canonicalizable shared search link must reconstruct the same normalized search state and preserve the same result ordering as the sender.
2. **Zero redundant search requests on repeat navigation:** revisiting a search whose normalized cache key is already present in the current session must issue **0** additional search endpoint requests.

For repeat navigation this means a **100% cache-hit target** for an already-fetched normalized key and **0 ms of new network/search-endpoint latency**, because no new request is allowed to fire.

---

## Search screen and URL ownership

```text
┌─────────────────────────────────────────────────────────────┐
│ FILTER PANEL — owns canonical search state                  │
│                                                             │
│ Destination                                                 │
│ [ Lisbon                              ]  →  dest            │
│                                                             │
│ Check-in                  Check-out                          │
│ [ 2024-09-20 ] → checkin  [ 2024-09-23 ] → checkout        │
│                                                             │
│ Maximum price / night                                       │
│ [ 180                                 ]  →  maxprice        │
│                                                             │
│ [ Search ]                                                  │
├─────────────────────────────────────────────────────────────┤
│ SHARED URL STRIP — owns canonical serialization             │
│                                                             │
│ /trip-planner?dest=lisbon&checkin=2024-09-20&               │
│ checkout=2024-09-23&maxprice=180                            │
│                                             [ Copy link ]    │
├─────────────────────────────────────────────────────────────┤
│ RESULTS LIST — owned by normalized TanStack Query key       │
│                                                             │
│ Lisbon Central Hotel                                        │
│ €142/night · 8.7 rating · 1.3 km from centre               │
│                                                             │
│ Alfama Garden Rooms                                         │
│ €118/night · 9.1 rating · 0.6 km from centre               │
│                                                             │
│ Riverside Apartment                                         │
│ €176/night · 8.4 rating · 2.1 km from centre               │
└─────────────────────────────────────────────────────────────┘
```

The filter panel writes **canonical keys only**: `dest`, `checkin`, `checkout`, and `maxprice`. The shared URL strip serializes the normalized canonical state into the copyable link. The results list is owned by the normalized TanStack Query cache key, so reopening the same canonical search must preserve result fidelity and issue zero redundant search requests.

Legacy keys are decoder-only compatibility aliases and are never written back into newly generated links.

---

## Parameter contract

| Query key | Role | Type after decode | Allowed format / validation boundary | Optional? | Default state | Degradation / fallback rule |
|---|---|---|---|---|---|---|
| `dest` | Canonical destination | `string \| undefined` | URL-decoded text, trimmed; must contain at least 1 non-whitespace character; max 100 characters | Required to execute search | `undefined` | Missing, blank-after-trim, or over 100 chars → `undefined`; do not execute search until a valid destination exists. |
| `city` | Legacy alias for `dest` | `string \| undefined` | Same validation as `dest` | Legacy/optional | none | If canonical `dest` is absent or invalid and `city` is valid, use it as `dest`. Otherwise ignore it. Never keep `city` in canonical state or cache key. |
| `destination` | Legacy alias for `dest` | `string \| undefined` | Same validation as `dest` | Legacy/optional | none | If both `dest` and `city` fail/are absent and `destination` is valid, use it as `dest`. Otherwise ignore it. Never keep it in canonical state or cache key. |
| `checkin` | Canonical check-in date | `string \| undefined` | Strict `YYYY-MM-DD`; must represent a real calendar date | Required to execute search | `undefined` | Missing, empty, malformed, impossible, or non-ISO value → `undefined`; do not execute search until corrected. Never invent a replacement date. |
| `checkout` | Canonical check-out date | `string \| undefined` | Strict `YYYY-MM-DD`; must represent a real calendar date and be strictly later than valid `checkin` | Required to execute search | `undefined` | Missing, empty, malformed, impossible, equal to `checkin`, or earlier than `checkin` → `undefined`; do not execute search until corrected. |
| `maxprice` | Canonical nightly price cap | `number \| undefined` | Base-10 finite integer in range **1–1000** | Optional | `undefined` = no price cap | Missing or empty → `undefined`. Non-numeric/non-finite → `undefined`. Numeric values `<1` clamp to `1`; numeric values `>1000` clamp to `1000`. Never coerce an empty string to `0`. |
| `budget` | Legacy alias for `maxprice` | `number \| undefined` | Same parsing and range rules as `maxprice` | Legacy/optional | none | If canonical `maxprice` is absent/invalid and `budget` can be parsed, use the normalized `budget` value as `maxprice`. Otherwise ignore it. Never keep `budget` in canonical state or cache key. |

### Alias precedence

Destination resolution is deterministic:

```text
valid dest → valid city → valid destination → undefined
```

Price-cap resolution is deterministic:

```text
valid/normalizable maxprice → valid/normalizable budget → undefined
```

Canonical keys win when they are valid. Legacy aliases exist only to recover older shared links.

---

## Unknown parameter rule

Any query key outside the recognized set below is **dropped completely**:

```text
dest, city, destination, checkin, checkout, maxprice, budget
```

For example, `sort=cheapest` and `currency=GBP` are ignored. Unknown keys:

- do not enter application search state;
- do not participate in validation;
- do not enter the TanStack Query key;
- are not written back into a canonical shared URL;
- must never invalidate an otherwise valid search.

---

## Canonical normalized search state

After alias resolution and validation, the URL decoder produces only this shape:

```ts
type NormalizedSearchState = {
  dest: string | undefined;
  checkin: string | undefined;
  checkout: string | undefined;
  maxprice: number | undefined;
};
```

Normalization rules:

1. `dest`: URL-decode, trim leading/trailing whitespace, collapse repeated internal whitespace to one space, then lowercase for identity/cache purposes.
2. `checkin`: retain the validated ISO `YYYY-MM-DD` string exactly.
3. `checkout`: retain the validated ISO `YYYY-MM-DD` string exactly.
4. `maxprice`: parse once to a finite integer and apply the range rule above.
5. Legacy aliases are removed after resolution.
6. Unknown parameters are removed before state construction.

A search request is enabled only when `dest`, `checkin`, and `checkout` are all valid. `maxprice` may be absent.

---

## Canonical URL serialization

Newly generated/shared links use only canonical keys and a fixed parameter order:

```text
/trip-planner?dest=<dest>&checkin=<YYYY-MM-DD>&checkout=<YYYY-MM-DD>[&maxprice=<integer>]
```

Serialization order is always:

```text
dest → checkin → checkout → maxprice
```

`maxprice` is omitted when its normalized value is `undefined`. Legacy aliases and unknown keys are never emitted.

---

## TanStack Query cache-key contract

The cache key is built **only from normalized canonical search state**, never from the raw URL string:

```ts
[
  "accommodation-search",
  normalized.dest,
  normalized.checkin,
  normalized.checkout,
  normalized.maxprice ?? null,
]
```

Exact ordering:

```text
namespace → dest → checkin → checkout → maxprice
```

### Cache-key rules

- Normalize aliases before constructing the key, so `city=vienna` and `dest=vienna` resolve to the same cache entry.
- Normalize destination whitespace/case before constructing the key.
- Use only validated ISO dates.
- Use the normalized/clamped numeric `maxprice`; use `null` when no cap exists.
- Exclude legacy key names and all unknown parameters.
- Do not create/execute a search query when required normalized values are missing.

Example equivalence:

```text
?city=Vienna&checkin=2024-08-01&checkout=2024-08-05&maxprice=130

and

?dest=vienna&checkin=2024-08-01&checkout=2024-08-05&maxprice=130
```

both produce:

```ts
["accommodation-search", "vienna", "2024-08-01", "2024-08-05", 130]
```

---

## Degradation examples

| Incoming URL state | Normalized outcome |
|---|---|
| `city=vienna` with valid dates/price | `city` is translated to canonical `dest=vienna`. |
| `destination=krakow` with valid dates/price | `destination` is translated to canonical `dest=krakow`. |
| `budget=150` and no `maxprice` | `budget` is translated to canonical `maxprice=150`. |
| `checkin=` | `checkin=undefined`; search is disabled until corrected. |
| `checkin=2024-13-40` | `checkin=undefined`; search is disabled. |
| `checkin=25-09-2024` | rejected as non-ISO; `checkin=undefined`; search is disabled. |
| `checkout` missing | `checkout=undefined`; search is disabled. |
| `checkout === checkin` | `checkout=undefined`; search is disabled. |
| `checkout < checkin` | `checkout=undefined`; search is disabled. |
| `dest=%20` | trims to blank → `dest=undefined`; search is disabled. |
| `maxprice=` | `maxprice=undefined`; no price cap; never becomes `0`. |
| `maxprice=abc` | `maxprice=undefined`; no price cap; page must not crash. |
| `maxprice=-50` | normalized to `maxprice=1`. |
| `maxprice=99999` | normalized to `maxprice=1000`. |
| `sort=cheapest` | dropped completely. |
| `currency=GBP` | dropped completely. |

---

## Acceptance targets

### Shared-link fidelity

**Target: 100%.**

For every valid or recoverable legacy shared link, recipient navigation must decode to the same canonical search state as the sender. The same canonical state must identify the same cached/search result set and preserve result ordering.

### Repeat-navigation caching

**Target: 0 redundant search requests.**

If a normalized search key has already been fetched and remains in the current client cache, navigating away and back to that exact normalized search must issue **0** additional search endpoint requests.

Equivalent measurable target:

```text
repeat-navigation cache hit rate for an already-fetched key = 100%
new endpoint requests for that repeat = 0
new network/search-endpoint latency for that repeat = 0 ms
```

---

## Implementation boundary

This document is the contract. Implementation must follow it rather than redefining behavior in code. Any change to query names, alias precedence, validation, fallback behavior, URL serialization, cache-key shape, or acceptance targets requires updating this contract first.
