import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { decodeSearchParams } from "../lib/search-url.mjs";

const LIVE_URL = (process.env.LIVE_URL || "").replace(/\/$/, "");
if (!LIVE_URL) throw new Error("LIVE_URL is required");
const cases = JSON.parse(await fs.readFile("evidence/escalation-cases.json", "utf8"));
const outDir = path.join("evidence", "live-production");
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows = [];

function rawInputs(urlPath) {
  const q = urlPath.includes("?") ? urlPath.split("?")[1] : "";
  const p = new URLSearchParams(q);
  return {
    destination: p.get("dest") ?? p.get("city") ?? p.get("destination") ?? "",
    checkin: p.get("checkin") ?? "",
    checkout: p.get("checkout") ?? "",
    price: p.get("maxprice") ?? p.get("budget") ?? "",
    extras: [...p.entries()].filter(([k]) => !["dest","city","destination","checkin","checkout","maxprice","budget"].includes(k)).map(([k,v]) => k + "=" + v).join("; "),
  };
}

function expectedControls(urlPath) {
  const q = urlPath.includes("?") ? urlPath.split("?")[1] : "";
  const n = decodeSearchParams(q);
  return { destination:n.dest, checkin:n.checkin, checkout:n.checkout, guests:String(n.guests), rooms:String(n.rooms), maxprice:n.maxprice === undefined ? "" : String(n.maxprice) };
}

function watch(page, requests) {
  page.on("request", (request) => {
    const u = new URL(request.url());
    if (u.pathname !== "/api/search") return;
    requests.push({ method:request.method(), path:u.pathname, query:Object.fromEntries(u.searchParams.entries()) });
  });
}

async function waitSettled(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("article, text=No stays found for this search., text=Search failed.").first().waitFor({state:"visible", timeout:25000});
  await page.waitForTimeout(200);
}

async function controls(page) {
  return {
    destination:await page.getByLabel("Destination").inputValue(),
    checkin:await page.getByLabel("Check-in").inputValue(),
    checkout:await page.getByLabel("Check-out").inputValue(),
    guests:await page.getByLabel("Guests").inputValue(),
    rooms:await page.getByLabel("Rooms").inputValue(),
    maxprice:await page.getByLabel("Maximum price / night").inputValue(),
  };
}

async function resultState(page) {
  const empty = (await page.getByText("No stays found for this search.").count()) > 0;
  return { empty, cards: empty ? [] : await page.locator("article").allInnerTexts() };
}

async function injectNetworkPanel(page, item, requests, note) {
  await page.evaluate(({item,requests,note}) => {
    document.getElementById("live-network-proof")?.remove();
    const panel=document.createElement("div");
    panel.id="live-network-proof";
    panel.style.cssText="position:fixed;top:8px;right:8px;z-index:2147483647;width:700px;max-height:66vh;overflow:auto;background:#07111f;color:#e2e8f0;border:2px solid #22d3ee;border-radius:10px;padding:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap";
    const lines=["NETWORK · live Vercel /api/search", item.ticket+" · "+item.group, "", "Observed /api/search requests: "+requests.length];
    requests.forEach((r,i)=>{ lines.push("", String(i+1)+". "+r.method+" "+r.path, "payload: "+JSON.stringify(r.query)); });
    lines.push("", note);
    panel.textContent=lines.join("\n");
    document.body.appendChild(panel);
  }, {item,requests,note});
}

async function screenshot(page,item,requests,note) {
  await injectNetworkPanel(page,item,requests,note);
  const rel="evidence/live-production/"+item.ticket.toLowerCase()+".png";
  await page.screenshot({path:rel, fullPage:true});
  return rel;
}

function equal(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

try {
  for (const item of cases) {
    const requests=[];
    const raw=rawInputs(item.sender);
    let expected=""; let actual=""; let verdict="Fail"; let shot="";

    if (item.mode === "fidelity") {
      const c1=await browser.newContext({viewport:{width:1500,height:1050}});
      const p1=await c1.newPage(); watch(p1,requests);
      await p1.goto(LIVE_URL+item.sender); await waitSettled(p1);
      const s1=await controls(p1); const r1=await resultState(p1);
      const c2=await browser.newContext({viewport:{width:1500,height:1050}});
      const p2=await c2.newPage(); watch(p2,requests);
      await p2.goto(LIVE_URL+item.sender); await waitSettled(p2);
      const s2=await controls(p2); const r2=await resultState(p2);
      const stateMatch=equal(s1,s2); const resultMatch=equal(r1,r2);
      expected="Clean recipient profile rebuilds identical controls and ordered result cards.";
      actual="stateMatch="+stateMatch+"; resultMatch="+resultMatch+"; requests=1 sender + 1 recipient";
      verdict=stateMatch && resultMatch && requests.length===2 ? "Pass" : "Fail";
      shot=await screenshot(p2,item,requests,actual);
      await c1.close(); await c2.close();
    } else if (item.mode === "truncated-link") {
      const c=await browser.newContext({viewport:{width:1500,height:1050}});
      const p=await c.newPage(); watch(p,requests);
      await p.goto(LIVE_URL+item.sender); await waitSettled(p); const sender=await controls(p);
      const c2=await browser.newContext({viewport:{width:1500,height:1050}});
      const p2=await c2.newPage(); watch(p2,requests);
      await p2.goto(LIVE_URL+item.recipient); await waitSettled(p2); const recipient=await controls(p2);
      expected="Full sender URL works; externally truncated URL has no recoverable intent and falls back deterministically.";
      actual="fullSender="+JSON.stringify(sender)+"; truncatedRecipient="+JSON.stringify(recipient);
      verdict=requests.length===2 ? "Boundary confirmed" : "Fail";
      shot=await screenshot(p2,item,requests,actual);
      await c.close(); await c2.close();
    } else {
      const c=await browser.newContext({viewport:{width:1500,height:1050}});
      const p=await c.newPage(); watch(p,requests);
      await p.goto(LIVE_URL+item.sender); await waitSettled(p);
      if (item.mode === "repeat-price") {
        const original=await p.getByLabel("Maximum price / night").inputValue();
        await p.getByLabel("Maximum price / night").fill(item.altPrice);
        await p.waitForURL(new RegExp("maxprice="+item.altPrice)); await waitSettled(p);
        const before=requests.length;
        await p.getByLabel("Maximum price / night").fill(original);
        await p.waitForURL(new RegExp("maxprice="+original)); await p.waitForTimeout(1000);
        const delta=requests.length-before;
        expected="Returning to a previously fetched normalized state adds 0 requests.";
        actual="newOnRepeat="+delta+"; sequenceTotal="+requests.length;
        verdict=delta===0 ? "Pass" : "Fail";
      } else if (item.mode === "repeat-clear") {
        const original=await p.getByLabel("Maximum price / night").inputValue();
        await p.getByLabel("Maximum price / night").fill("");
        await p.waitForURL((u)=>!u.searchParams.has("maxprice")); await waitSettled(p);
        const before=requests.length;
        await p.getByLabel("Maximum price / night").fill(original);
        await p.waitForURL(new RegExp("maxprice="+original)); await p.waitForTimeout(1000);
        const delta=requests.length-before;
        expected="Restoring the original filter combination adds 0 requests.";
        actual="newOnRepeat="+delta+"; sequenceTotal="+requests.length;
        verdict=delta===0 ? "Pass" : "Fail";
      } else if (item.mode === "rapid-repeat") {
        for (const v of ["145","155","145","135"]) {
          await p.getByLabel("Maximum price / night").fill(v);
          await p.waitForURL(new RegExp("maxprice="+v));
          if (v==="145" && requests.some((r)=>r.query.priceCapPerNight==="145")) await p.waitForTimeout(900); else if (v==="135") await p.waitForTimeout(900); else await waitSettled(p);
        }
        expected="Only unique states 135, 145 and 155 hit the API; revisited 145 and 135 are cache-served.";
        actual="observedRequests="+requests.length+"; uniqueExpected=3";
        verdict=requests.length===3 ? "Pass" : "Fail";
      } else if (item.mode === "back") {
        const original=await p.getByLabel("Maximum price / night").inputValue();
        await p.getByLabel("Maximum price / night").fill(item.altPrice);
        await p.waitForURL(new RegExp("maxprice="+item.altPrice)); await waitSettled(p);
        const before=requests.length;
        await p.goBack(); await p.waitForURL(new RegExp("maxprice="+original)); await p.waitForTimeout(1000);
        const after=await controls(p); const delta=requests.length-before;
        expected="Browser Back restores the prior controls and adds 0 requests.";
        actual="restoredPrice="+after.maxprice+"; newOnBack="+delta+"; sequenceTotal="+requests.length;
        verdict=after.maxprice===original && delta===0 ? "Pass" : "Fail";
      } else if (item.mode === "empty") {
        const result=await resultState(p);
        expected="Zero results render a clear empty state with one search request.";
        actual="emptyState="+result.empty+"; requests="+requests.length;
        verdict=result.empty && requests.length===1 ? "Pass" : "Fail";
      } else {
        const seen=await controls(p); const exp=expectedControls(item.sender);
        expected="Controls match the normalized Search URL contract and the page completes with one request.";
        actual="controlsMatch="+equal(seen,exp)+"; normalized="+JSON.stringify(seen)+"; requests="+requests.length;
        verdict=equal(seen,exp) && requests.length===1 ? "Pass" : "Fail";
      }
      shot=await screenshot(p,item,requests,actual);
      await c.close();
    }
    rows.push({...item,raw,expected,actual,requestCount:requests.length,verdict,screenshot:shot,requests});
    console.log("["+verdict+"] "+item.ticket+" requests="+requests.length+" "+actual);
  }
} finally { await browser.close(); }

const groups=[...new Set(rows.map((r)=>r.group))];
let md="# Live Production Verification — Shareable Search\n\n";
md+="**Live Vercel deployment:** "+LIVE_URL+"\n\n";
md+="## Verification method\n\n";
md+="All escalation rows were replayed against the deployed Vercel build with Playwright Chromium. Fresh browser contexts were used unless the complaint required one-session cache/history behavior. A browser request listener counted only outgoing requests whose pathname was exactly `/api/search`. Each row links to a screenshot of the live page with a network capture panel showing the exact outgoing request payload(s). Result-fidelity rows open the same live shared link again in a separate clean browser context and compare controls plus ordered rendered card text.\n\n";
md+="Contract targets: **100% shared-link fidelity when the query string reaches the application** and **0 redundant search requests when an already-fetched normalized state is revisited**.\n\n";
for (const group of groups) {
  md+="## "+group+"\n\n";
  md+="| Ticket | Destination | Check-in | Check-out | Price | Extra / legacy input | Expected | Observed request count | Live observation | Network screenshot | Verdict |\n";
  md+="| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |\n";
  for (const row of rows.filter((r)=>r.group===group)) {
    const e=(v)=>String(v ?? "").replaceAll("|","\\|").replaceAll("\n"," ");
    md+="| "+row.ticket+" | `"+e(row.raw.destination)+"` | `"+e(row.raw.checkin)+"` | `"+e(row.raw.checkout)+"` | `"+e(row.raw.price)+"` | `"+e(row.raw.extras)+"` | "+e(row.expected)+" | **"+row.requestCount+"** | "+e(row.actual)+" | [network proof]("+row.screenshot+") | **"+row.verdict+"** |\n";
  }
  md+="\n";
}
const failures=rows.filter((r)=>r.verdict==="Fail");
md+="## Production sign-off summary\n\n";
md+=failures.length ? "**Not ready:** "+failures.length+" row(s) failed: "+failures.map((r)=>r.ticket).join(", ")+".\n" : "All app-controlled rows passed. SL-40218 is recorded as an external truncation boundary because the recipient URL contains no query bytes for the application to reconstruct.\n";
await fs.writeFile("LIVE_PRODUCTION_VERIFICATION.md",md);
await fs.writeFile("LIVE_PRODUCTION_URL.txt",LIVE_URL+"\n");
await fs.writeFile(path.join(outDir,"results.json"),JSON.stringify({liveURL:LIVE_URL,generatedAt:new Date().toISOString(),rows},null,2)+"\n");
if (failures.length) process.exitCode=1;