# Shareable Search Acceptance Evidence — first-pass

## Verification method

Run against the local Next.js development server in GitHub Actions using Node 22 and headless Chromium through Playwright. Browser request listeners count only requests whose pathname is exactly `/api/search`. Each screenshot includes the live trip-planner page plus an injected **Acceptance Network Panel** showing the exact captured search request URLs and count for that scenario.

Contract numbers under test:

- **100% shared-link fidelity**
- **0 redundant search requests on repeat navigation**

## Acceptance evidence

| Case | Contract target | Action taken | Expected | Observed requests | Screenshot | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Cold load from canonical URL | **100% shared-link fidelity** | Opened a complete canonical search URL in a fresh browser context. | Controls and results rebuild from URL alone; 1 cold search request. | **1 total** | [open screenshot](evidence/search-url/first-pass/01-cold-load.png) | **Pass** |
| Repeat filter combination | **0 redundant search requests** | Changed max price 180 → 160 → 180 in one session. | Returning to the already-fetched 180 state adds 0 requests. | **0 new on repeat (2 total in sequence)** | [open screenshot](evidence/search-url/first-pass/02-repeat-filter-zero.png) | **Pass** |
| Browser back to cached search | **0 redundant search requests** | Loaded 180, changed to 160, then used browser Back. | URL/control state returns to 180 and adds 0 requests. | **0 new on back (2 total in sequence)** | [open screenshot](evidence/search-url/first-pass/03-browser-back.png) | **Pass** |
| Pasted shared link in clean profile | **100% shared-link fidelity** | Copied a populated Vienna URL and opened it in a new browser context. | Same controls and same ordered result cards as source; 1 cold request. | **1 total** | [open screenshot](evidence/search-url/first-pass/04-pasted-clean-profile.png) | **Pass** |
| SL-0107 — Clean link | **100% shared-link fidelity** | Opened capture-log query: `dest=Amsterdam&checkin=2025-02-06&checkout=2025-02-09&guests=2&rooms=1` | Normalized state: `{"dest":"Amsterdam","checkin":"2025-02-06","checkout":"2025-02-09","guests":2,"rooms":1}` | **1 total** | [open screenshot](evidence/search-url/first-pass/05-sl-0107-clean.png) | **Pass** |
| SL-0104 — Legacy field names | **100% shared-link fidelity** | Opened capture-log query: `dest=Barcelona&checkin_monthday=22&checkin_month=2&checkin_year=2025&adults=3&rooms=1&price_max=180&sortBy=review_score_desc` | Normalized state: `{"dest":"Barcelona","checkin":"2025-02-22","checkout":"2025-02-23","guests":3,"rooms":1,"maxprice":"180"}` | **1 total** | [open screenshot](evidence/search-url/first-pass/06-sl-0104-legacy.png) | **Pass** |
| SL-0128 — Missing key fields | **100% shared-link fidelity** | Opened capture-log query: `aid=304142&label=gog235jc&utm_source=imessage` | Normalized state: `{"dest":"anywhere","checkin":"2025-01-01","checkout":"2025-01-02","guests":2,"rooms":1}` | **1 total** | [open screenshot](evidence/search-url/first-pass/07-sl-0128-missing.png) | **Pass** |
| SL-0180 — Out-of-range price | **100% shared-link fidelity** | Opened capture-log query: `ss=Palma&checkin=2025-06-14&checkout=2025-06-21&group_adults=4&no_rooms=2&maxPrice=9999999` | Normalized state: `{"dest":"Palma","checkin":"2025-06-14","checkout":"2025-06-21","guests":4,"rooms":2,"maxprice":"1000"}` | **1 total** | [open screenshot](evidence/search-url/first-pass/08-sl-0180-clamped-price.png) | **Pass** |
| SL-0142 — Invalid date recovery | **100% shared-link fidelity** | Opened capture-log query: `ss=Naples&checkin=2024-13-45&checkout=2025-09-1&adults=abc&nflt=zz_unknown_code%3D7` | Normalized state: `{"dest":"Naples","checkin":"2025-08-31","checkout":"2025-09-01","guests":2,"rooms":1}` | **1 total** | [open screenshot](evidence/search-url/first-pass/09-sl-0142-invalid-date.png) | **Pass** |

## Run result

All required rows passed.

Raw route output for this run is stored beside the screenshots as `server.log`.
