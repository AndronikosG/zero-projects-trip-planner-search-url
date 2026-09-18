import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const runLabel = process.env.EVIDENCE_RUN ?? "first-pass";
const evidenceDir = path.join("evidence", "search-url", runLabel);
await fs.mkdir(evidenceDir, { recursive: true });

const rows = [];

function requestPath(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/api/search" ? parsed.pathname + parsed.search : null;
  } catch {
    return null;
  }
}

function watchSearchRequests(page) {
  const requests = [];
  page.on("request", (request) => {
    const value = requestPath(request.url());
    if (value) requests.push(value);
  });
  return requests;
}

async function waitForResults(page) {
  try {
    await page.locator("article").first().waitFor({ state: "visible", timeout: 15_000 });
  } catch (error) {
    console.error("[BROWSER_DIAGNOSTIC] URL:", page.url());
    console.error("[BROWSER_DIAGNOSTIC] body:", (await page.locator("body").innerText()).slice(0, 4000));
    throw error;
  }
}

async function controls(page) {
  return {
    dest: await page.getByLabel("Destination").inputValue(),
    checkin: await page.getByLabel("Check-in").inputValue(),
    checkout: await page.getByLabel("Check-out").inputValue(),
    guests: Number(await page.getByLabel("Guests").inputValue()),
    rooms: Number(await page.getByLabel("Rooms").inputValue()),
    maxprice: (await page.getByLabel("Maximum price / night").inputValue()) || undefined,
  };
}

async function resultSnapshot(page) {
  return {
    heading: await page.locator("h2").filter({ hasText: "Stays in" }).innerText(),
    cards: await page.locator("article").allInnerTexts(),
  };
}

async function addNetworkPanel(page, title, requests, note) {
  await page.evaluate(
    ({ title, requests, note }) => {
      document.getElementById("acceptance-network-panel")?.remove();
      const panel = document.createElement("div");
      panel.id = "acceptance-network-panel";
      panel.style.cssText = [
        "position:fixed",
        "top:12px",
        "right:12px",
        "z-index:2147483647",
        "width:560px",
        "max-height:46vh",
        "overflow:auto",
        "background:#07111f",
        "color:#dbeafe",
        "border:2px solid #38bdf8",
        "border-radius:10px",
        "box-shadow:0 12px 32px rgba(0,0,0,.35)",
        "padding:14px",
        "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
      ].join(";");
      const lines = [
        "ACCEPTANCE NETWORK PANEL — /api/search",
        title,
        "",
        `Observed search requests: ${requests.length}`,
        ...requests.map((value, index) => `${index + 1}. ${value}`),
        "",
        note,
      ];
      panel.textContent = lines.join("\n");
      document.body.appendChild(panel);
    },
    { title, requests, note },
  );
}

async function screenshot(page, filename, title, requests, note) {
  await addNetworkPanel(page, title, requests, note);
  const fullPath = path.join(evidenceDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath.replaceAll("\\", "/");
}

function sameState(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function addRow(row) {
  rows.push(row);
  console.log(`[${row.result}] ${row.caseName} — requests: ${row.observedRequests}`);
}

const browser = await chromium.launch({ headless: true });

try {
  // 1. Cold load
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("[PAGE_ERROR]", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.error("[BROWSER_CONSOLE]", message.text());
    });
    const requests = watchSearchRequests(page);
    const url =
      baseURL +
      "/?dest=Lisbon&checkin=2025-10-10&checkout=2025-10-13&guests=2&rooms=1&maxprice=180";
    await page.goto(url);
    await waitForResults(page);
    const actual = await controls(page);
    const passed =
      sameState(actual, {
        dest: "Lisbon",
        checkin: "2025-10-10",
        checkout: "2025-10-13",
        guests: 2,
        rooms: 1,
        maxprice: "180",
      }) && requests.length === 1;
    const shot = await screenshot(
      page,
      "01-cold-load.png",
      "Cold URL load",
      requests,
      `Controls rebuilt: ${JSON.stringify(actual)}`,
    );
    addRow({
      caseName: "Cold load from canonical URL",
      contract: "100% shared-link fidelity",
      action: "Opened a complete canonical search URL in a fresh browser context.",
      expected: "Controls and results rebuild from URL alone; 1 cold search request.",
      observedRequests: `${requests.length} total`,
      screenshot: shot,
      result: passed ? "Pass" : "Fail",
    });
    await context.close();
  }

  // 2. Repeat exact filter combination
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage();
    const requests = watchSearchRequests(page);
    await page.goto(
      baseURL +
        "/?dest=Lisbon&checkin=2025-10-10&checkout=2025-10-13&guests=2&rooms=1&maxprice=180",
    );
    await waitForResults(page);
    await page.getByLabel("Maximum price / night").fill("160");
    await page.waitForURL(/maxprice=160/);
    await waitForResults(page);
    const beforeReturn = requests.length;
    await page.getByLabel("Maximum price / night").fill("180");
    await page.waitForURL(/maxprice=180/);
    await page.waitForTimeout(800);
    const repeatDelta = requests.length - beforeReturn;
    const passed = repeatDelta === 0;
    const shot = await screenshot(
      page,
      "02-repeat-filter-zero.png",
      "Repeat filter combination: 180 → 160 → 180",
      requests,
      `New requests on return to cached 180 state: ${repeatDelta}`,
    );
    addRow({
      caseName: "Repeat filter combination",
      contract: "0 redundant search requests",
      action: "Changed max price 180 → 160 → 180 in one session.",
      expected: "Returning to the already-fetched 180 state adds 0 requests.",
      observedRequests: `${repeatDelta} new on repeat (${requests.length} total in sequence)`,
      screenshot: shot,
      result: passed ? "Pass" : "Fail",
    });
    await context.close();
  }

  // 3. Browser back
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage();
    const requests = watchSearchRequests(page);
    await page.goto(
      baseURL +
        "/?dest=Porto&checkin=2025-11-04&checkout=2025-11-08&guests=2&rooms=1&maxprice=180",
    );
    await waitForResults(page);
    await page.getByLabel("Maximum price / night").fill("160");
    await page.waitForURL(/maxprice=160/);
    await waitForResults(page);
    const beforeBack = requests.length;
    await page.goBack();
    await page.waitForTimeout(900);
    const after = await controls(page);
    const backDelta = requests.length - beforeBack;
    const passed = after.maxprice === "180" && backDelta === 0;
    const shot = await screenshot(
      page,
      "03-browser-back.png",
      "Browser back after price 180 → 160",
      requests,
      `After back maxprice=${after.maxprice}; new requests on back=${backDelta}`,
    );
    addRow({
      caseName: "Browser back to cached search",
      contract: "0 redundant search requests",
      action: "Loaded 180, changed to 160, then used browser Back.",
      expected: "URL/control state returns to 180 and adds 0 requests.",
      observedRequests: `${backDelta} new on back (${requests.length} total in sequence)`,
      screenshot: shot,
      result: passed ? "Pass" : "Fail",
    });
    await context.close();
  }

  // 4. Pasted URL in clean profile
  {
    const sourceContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const source = await sourceContext.newPage();
    await source.goto(
      baseURL +
        "/?dest=Vienna&checkin=2025-12-02&checkout=2025-12-06&guests=3&rooms=2&maxprice=220",
    );
    await waitForResults(source);
    const sourceControls = await controls(source);
    const sourceResults = await resultSnapshot(source);
    const copiedURL = source.url();

    const cleanContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const pasted = await cleanContext.newPage();
    const requests = watchSearchRequests(pasted);
    await pasted.goto(copiedURL);
    await waitForResults(pasted);
    const pastedControls = await controls(pasted);
    const pastedResults = await resultSnapshot(pasted);
    const passed =
      JSON.stringify(sourceControls) === JSON.stringify(pastedControls) &&
      JSON.stringify(sourceResults) === JSON.stringify(pastedResults) &&
      requests.length === 1;
    const shot = await screenshot(
      pasted,
      "04-pasted-clean-profile.png",
      "Pasted shared URL in a clean browser context",
      requests,
      `State match=${JSON.stringify(sourceControls) === JSON.stringify(pastedControls)}; results match=${JSON.stringify(sourceResults) === JSON.stringify(pastedResults)}`,
    );
    addRow({
      caseName: "Pasted shared link in clean profile",
      contract: "100% shared-link fidelity",
      action: "Copied a populated Vienna URL and opened it in a new browser context.",
      expected: "Same controls and same ordered result cards as source; 1 cold request.",
      observedRequests: `${requests.length} total`,
      screenshot: shot,
      result: passed ? "Pass" : "Fail",
    });
    await sourceContext.close();
    await cleanContext.close();
  }

  const decoderCases = [
    {
      id: "SL-0107",
      label: "Clean link",
      query:
        "dest=Amsterdam&checkin=2025-02-06&checkout=2025-02-09&guests=2&rooms=1",
      expected: {
        dest: "Amsterdam",
        checkin: "2025-02-06",
        checkout: "2025-02-09",
        guests: 2,
        rooms: 1,
        maxprice: undefined,
      },
      filename: "05-sl-0107-clean.png",
    },
    {
      id: "SL-0104",
      label: "Legacy field names",
      query:
        "dest=Barcelona&checkin_monthday=22&checkin_month=2&checkin_year=2025&adults=3&rooms=1&price_max=180&sortBy=review_score_desc",
      expected: {
        dest: "Barcelona",
        checkin: "2025-02-22",
        checkout: "2025-02-23",
        guests: 3,
        rooms: 1,
        maxprice: "180",
      },
      filename: "06-sl-0104-legacy.png",
    },
    {
      id: "SL-0128",
      label: "Missing key fields",
      query: "aid=304142&label=gog235jc&utm_source=imessage",
      expected: {
        dest: "anywhere",
        checkin: "2025-01-01",
        checkout: "2025-01-02",
        guests: 2,
        rooms: 1,
        maxprice: undefined,
      },
      filename: "07-sl-0128-missing.png",
    },
    {
      id: "SL-0180",
      label: "Out-of-range price",
      query:
        "ss=Palma&checkin=2025-06-14&checkout=2025-06-21&group_adults=4&no_rooms=2&maxPrice=9999999",
      expected: {
        dest: "Palma",
        checkin: "2025-06-14",
        checkout: "2025-06-21",
        guests: 4,
        rooms: 2,
        maxprice: "1000",
      },
      filename: "08-sl-0180-clamped-price.png",
    },
    {
      id: "SL-0142",
      label: "Invalid date recovery",
      query:
        "ss=Naples&checkin=2024-13-45&checkout=2025-09-1&adults=abc&nflt=zz_unknown_code%3D7",
      expected: {
        dest: "Naples",
        checkin: "2025-08-31",
        checkout: "2025-09-01",
        guests: 2,
        rooms: 1,
        maxprice: undefined,
      },
      filename: "09-sl-0142-invalid-date.png",
    },
  ];

  for (const item of decoderCases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage();
    const requests = watchSearchRequests(page);
    await page.goto(`${baseURL}/?${item.query}`);
    await waitForResults(page);
    const actual = await controls(page);
    const passed = sameState(actual, item.expected) && requests.length === 1;
    const shot = await screenshot(
      page,
      item.filename,
      `${item.id} — ${item.label}`,
      requests,
      `Normalized controls: ${JSON.stringify(actual)}`,
    );
    addRow({
      caseName: `${item.id} — ${item.label}`,
      contract: "100% shared-link fidelity",
      action: `Opened capture-log query: \`${item.query}\``,
      expected: `Normalized state: \`${JSON.stringify(item.expected)}\``,
      observedRequests: `${requests.length} total`,
      screenshot: shot,
      result: passed ? "Pass" : "Fail",
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = rows.filter((row) => row.result === "Fail");

const reportName =
  runLabel === "first-pass"
    ? "ACCEPTANCE_EVIDENCE_FIRST_PASS.md"
    : "ACCEPTANCE_EVIDENCE.md";

const markdown = `# Shareable Search Acceptance Evidence — ${runLabel}

## Verification method

Run against the local Next.js development server in GitHub Actions using Node 22 and headless Chromium through Playwright. Browser request listeners count only requests whose pathname is exactly \`/api/search\`. Each screenshot includes the live trip-planner page plus an injected **Acceptance Network Panel** showing the exact captured search request URLs and count for that scenario.

Contract numbers under test:

- **100% shared-link fidelity**
- **0 redundant search requests on repeat navigation**

## Acceptance evidence

| Case | Contract target | Action taken | Expected | Observed requests | Screenshot | Result |
| --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| ${row.caseName} | **${row.contract}** | ${row.action.replaceAll("|", "\\|")} | ${row.expected.replaceAll("|", "\\|")} | **${row.observedRequests}** | [open screenshot](${row.screenshot}) | **${row.result}** |`,
  )
  .join("\n")}

## Run result

${failures.length === 0 ? "All required rows passed." : `${failures.length} row(s) failed on this run: ${failures.map((row) => row.caseName).join(", ")}.`}

Raw route output for this run is stored beside the screenshots as \`server.log\`.
`;

await fs.writeFile(reportName, markdown);
await fs.writeFile(
  path.join(evidenceDir, "results.json"),
  JSON.stringify({ runLabel, rows, failures }, null, 2) + "\n",
);

console.log(`Wrote ${reportName}`);
console.log(`Failures: ${failures.length}`);
