# Live Production Verification — Shareable Search

**Live Vercel deployment:** https://zero-projects-trip-planner-search-url-andronikos-projects.vercel.app

## Verification method

All escalation rows were replayed against the deployed Vercel build with Playwright Chromium. Fresh browser contexts were used unless the complaint required one-session cache/history behavior. A browser request listener counted only outgoing requests whose pathname was exactly `/api/search`. Each row links to a screenshot of the live page with a network capture panel showing the exact outgoing request payload(s). Result-fidelity rows open the same live shared link again in a separate clean browser context and compare controls plus ordered rendered card text.

Contract targets: **100% shared-link fidelity when the query string reaches the application** and **0 redundant search requests when an already-fetched normalized state is revisited**.

## Shared-link state lost before the app

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40218 | `lisbon` | `2024-06-12` | `2024-06-16` | `140` | `` | Full sender URL works; externally truncated URL has no recoverable intent and falls back deterministically. | **2** | fullSender={"destination":"lisbon","checkin":"2024-06-12","checkout":"2024-06-16","guests":"2","rooms":"1","maxprice":"140"}; truncatedRecipient={"destination":"anywhere","checkin":"2025-01-01","checkout":"2025-01-02","guests":"2","rooms":"1","maxprice":""} | [network proof](evidence/live-production/sl-40218.png) | **Boundary confirmed** |

## Result-set fidelity mismatch

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40255 | `barcelona` | `2024-05-20` | `2024-05-23` | `110` | `` | Clean recipient profile rebuilds identical controls and ordered result cards. | **2** | stateMatch=true; resultMatch=true; requests=1 sender + 1 recipient | [network proof](evidence/live-production/sl-40255.png) | **Pass** |
| SL-41090 | `milan` | `2024-09-01` | `2024-09-04` | `170` | `` | Clean recipient profile rebuilds identical controls and ordered result cards. | **2** | stateMatch=true; resultMatch=true; requests=1 sender + 1 recipient | [network proof](evidence/live-production/sl-41090.png) | **Pass** |
| SL-41552 | `zurich` | `2024-09-18` | `2024-09-21` | `190` | `` | Clean recipient profile rebuilds identical controls and ordered result cards. | **2** | stateMatch=true; resultMatch=true; requests=1 sender + 1 recipient | [network proof](evidence/live-production/sl-41552.png) | **Pass** |

## Redundant fetch on repeat navigation

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40301 | `rome` | `2024-07-01` | `2024-07-08` | `200` | `` | Returning to a previously fetched normalized state adds 0 requests. | **2** | newOnRepeat=0; sequenceTotal=2 | [network proof](evidence/live-production/sl-40301.png) | **Pass** |
| SL-40810 | `copenhagen` | `2024-07-20` | `2024-07-24` | `180` | `` | Returning to a previously fetched normalized state adds 0 requests. | **2** | newOnRepeat=0; sequenceTotal=2 | [network proof](evidence/live-production/sl-40810.png) | **Pass** |
| SL-41355 | `hamburg` | `2024-09-12` | `2024-09-15` | `155` | `` | Restoring the original filter combination adds 0 requests. | **2** | newOnRepeat=0; sequenceTotal=2 | [network proof](evidence/live-production/sl-41355.png) | **Pass** |
| SL-41618 | `athens` | `2024-09-25` | `2024-09-29` | `135` | `` | Only unique states 135, 145 and 155 hit the API; revisited 145 and 135 are cache-served. | **3** | observedRequests=3; uniqueExpected=3 | [network proof](evidence/live-production/sl-41618.png) | **Pass** |

## Invalid checkout relationship

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40388 | `amsterdam` | `2024-06-30` | `2024-06-28` | `160` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"amsterdam","checkin":"2024-06-30","checkout":"2024-07-01","guests":"2","rooms":"1","maxprice":"160"}; requests=1 | [network proof](evidence/live-production/sl-40388.png) | **Pass** |
| SL-41419 | `venice` | `2024-08-25` | `2024-08-25` | `210` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"venice","checkin":"2024-08-25","checkout":"2024-08-26","guests":"2","rooms":"1","maxprice":"210"}; requests=1 | [network proof](evidence/live-production/sl-41419.png) | **Pass** |

## Price validation / bounds

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40412 | `paris` | `2024-06-10` | `2024-06-14` | `abc` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"paris","checkin":"2024-06-10","checkout":"2024-06-14","guests":"2","rooms":"1","maxprice":""}; requests=1 | [network proof](evidence/live-production/sl-40412.png) | **Pass** |
| SL-40889 | `dublin` | `2024-09-10` | `2024-09-13` | `-50` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"dublin","checkin":"2024-09-10","checkout":"2024-09-13","guests":"2","rooms":"1","maxprice":"1"}; requests=1 | [network proof](evidence/live-production/sl-40889.png) | **Pass** |
| SL-41221 | `seville` | `2024-09-05` | `2024-09-08` | `99999` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"seville","checkin":"2024-09-05","checkout":"2024-09-08","guests":"2","rooms":"1","maxprice":"1000"}; requests=1 | [network proof](evidence/live-production/sl-41221.png) | **Pass** |
| SL-41815 | `faro` | `2024-10-05` | `2024-10-09` | `` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"faro","checkin":"2024-10-05","checkout":"2024-10-09","guests":"2","rooms":"1","maxprice":""}; requests=1 | [network proof](evidence/live-production/sl-41815.png) | **Pass** |

## Legacy parameter compatibility

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40470 | `vienna` | `2024-08-01` | `2024-08-05` | `130` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"vienna","checkin":"2024-08-01","checkout":"2024-08-05","guests":"2","rooms":"1","maxprice":"130"}; requests=1 | [network proof](evidence/live-production/sl-40470.png) | **Pass** |
| SL-40533 | `prague` | `2024-09-02` | `2024-09-06` | `150` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"prague","checkin":"2024-09-02","checkout":"2024-09-06","guests":"2","rooms":"1","maxprice":"150"}; requests=1 | [network proof](evidence/live-production/sl-40533.png) | **Pass** |
| SL-41288 | `krakow` | `2024-08-30` | `2024-09-02` | `115` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"krakow","checkin":"2024-08-30","checkout":"2024-09-02","guests":"2","rooms":"1","maxprice":"115"}; requests=1 | [network proof](evidence/live-production/sl-41288.png) | **Pass** |

## Missing / malformed dates

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40601 | `berlin` | `` | `2024-07-10` | `120` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"berlin","checkin":"2024-07-09","checkout":"2024-07-10","guests":"2","rooms":"1","maxprice":"120"}; requests=1 | [network proof](evidence/live-production/sl-40601.png) | **Pass** |
| SL-40945 | `nice` | `2024-13-40` | `2024-07-05` | `140` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"nice","checkin":"2024-07-04","checkout":"2024-07-05","guests":"2","rooms":"1","maxprice":"140"}; requests=1 | [network proof](evidence/live-production/sl-40945.png) | **Pass** |
| SL-41156 | `split` | `2024-08-22` | `` | `145` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"split","checkin":"2024-08-22","checkout":"2024-08-23","guests":"2","rooms":"1","maxprice":"145"}; requests=1 | [network proof](evidence/live-production/sl-41156.png) | **Pass** |
| SL-41684 | `valencia` | `25-09-2024` | `28-09-2024` | `105` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"valencia","checkin":"2025-01-01","checkout":"2025-01-02","guests":"2","rooms":"1","maxprice":"105"}; requests=1 | [network proof](evidence/live-production/sl-41684.png) | **Pass** |

## Browser back state loss

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40677 | `madrid` | `2024-06-05` | `2024-06-09` | `95` | `` | Browser Back restores the prior controls and adds 0 requests. | **2** | restoredPrice=95; newOnBack=0; sequenceTotal=2 | [network proof](evidence/live-production/sl-40677.png) | **Pass** |

## Empty result handling

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-40742 | `oslo` | `2024-08-15` | `2024-08-18` | `250` | `` | Zero results render a clear empty state with one search request. | **1** | emptyState=true; requests=1 | [network proof](evidence/live-production/sl-40742.png) | **Pass** |

## Unknown parameter isolation

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-41022 | `porto` | `2024-08-08` | `2024-08-12` | `125` | `sort=cheapest` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"porto","checkin":"2024-08-08","checkout":"2024-08-12","guests":"2","rooms":"1","maxprice":"125"}; requests=1 | [network proof](evidence/live-production/sl-41022.png) | **Pass** |
| SL-41750 | `bruges` | `2024-09-28` | `2024-10-01` | `120` | `currency=GBP` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"bruges","checkin":"2024-09-28","checkout":"2024-10-01","guests":"2","rooms":"1","maxprice":"120"}; requests=1 | [network proof](evidence/live-production/sl-41750.png) | **Pass** |

## Blank destination

| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| SL-41487 | ` ` | `2024-09-20` | `2024-09-23` | `130` | `` | Controls match the normalized Search URL contract and the page completes with one request. | **1** | controlsMatch=true; normalized={"destination":"anywhere","checkin":"2024-09-20","checkout":"2024-09-23","guests":"2","rooms":"1","maxprice":"130"}; requests=1 | [network proof](evidence/live-production/sl-41487.png) | **Pass** |

## Production sign-off summary

All app-controlled rows passed. SL-40218 is recorded as an external truncation boundary because the recipient URL contains no query bytes for the application to reconstruct.
