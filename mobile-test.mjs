#!/usr/bin/env node
/**
 * Renue Home — mobile rendering test harness.
 *
 * Renders every page (and steps through each funnel) at real mobile viewports
 * using headless Chromium, screenshots them, and flags layout problems:
 *   - horizontal overflow (document scrollWidth > viewport width)
 *   - any element whose box extends past the right edge (the "top-right corner" bug)
 *   - the hovering sticky CTA bar overlapping the form once the quiz is engaged
 *
 * WHY: the in-app/automation browser we build with does not render below desktop
 * width, so phone-only issues (header overflow, sticky bar covering the form) slip
 * through. Run this locally or in CI to catch them automatically.
 *
 * SETUP (one time):
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * RUN against the live site:
 *   node mobile-test.mjs https://renuehome.com
 * RUN against a local copy (no network needed):
 *   npx serve . -l 8080   # or: python3 -m http.server 8080
 *   node mobile-test.mjs http://localhost:8080
 *
 * Output: ./mobile-shots/*.png  and a printed PASS/FAIL report (non-zero exit on FAIL).
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const BASE = (process.argv[2] || "http://localhost:8080").replace(/\/$/, "");
const OUT = "./mobile-shots";
mkdirSync(OUT, { recursive: true });

const PROFILES = [
  { name: "iPhone-SE", device: devices["iPhone SE"] },
  { name: "iPhone-14", device: devices["iPhone 14"] },
  { name: "iPhone-14-Pro-Max", device: devices["iPhone 14 Pro Max"] },
  { name: "Pixel-7", device: devices["Pixel 7"] },
];

const PAGES = [
  "/", "/windows", "/bathroom", "/roofing", "/hvac", "/kitchen",
  "/flooring", "/solar", "/gutters", "/painting", "/other",
  "/privacy", "/terms", "/ccpa", "/do-not-sell",
];

// Walk a vertical funnel to the last step so we screenshot every step on mobile.
async function stepThroughFunnel(page) {
  const states = [];
  for (let i = 0; i < 8; i++) {
    const onContact = await page.$('#f_first');
    if (onContact) { states.push("contact"); break; }
    const zip = await page.$('#f_zip');
    const addr = await page.$('#f_addr');
    if (zip) { await zip.fill("78733"); await page.click('[data-zip]'); }
    else if (addr) { await addr.fill("123 Main St"); await page.click('[data-addr]'); }
    else {
      const opt = await page.$('.opt[data-pick], .opt[data-multi]');
      if (opt) { await opt.click(); if (await page.$('[data-multinext]')) await page.click('[data-multinext]'); }
      else break;
    }
    await page.waitForTimeout(350);
    states.push("step" + (i + 2));
  }
  return states;
}

async function audit(page, label) {
  return await page.evaluate(() => {
    const iw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || r.width < 2) return;
      if (r.right > iw + 1 || r.left < -1) {
        offenders.push(el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "") + " right=" + Math.round(r.right));
      }
    });
    // sticky bar overlapping the quiz card while engaged?
    const sticky = document.querySelector(".sticky");
    const card = document.querySelector("#quizcard");
    let stickyOverlapsForm = false;
    if (sticky && card && getComputedStyle(sticky).display !== "none") {
      const sb = sticky.getBoundingClientRect(), cb = card.getBoundingClientRect();
      stickyOverlapsForm = document.body.classList.contains("quiz-engaged") && sb.top < cb.bottom && sb.top < window.innerHeight;
    }
    return {
      hScroll: document.documentElement.scrollWidth > iw + 1,
      scrollW: document.documentElement.scrollWidth, iw,
      offenders: offenders.slice(0, 12),
      engaged: document.body.classList.contains("quiz-engaged"),
      stickyOverlapsForm,
    };
  });
}

const results = [];
const browser = await chromium.launch();
for (const p of PROFILES) {
  const ctx = await browser.newContext({ ...p.device });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(400);
    const top = await audit(page, path);
    await page.screenshot({ path: `${OUT}/${p.name}_${path.replace(/\W+/g, "_") || "home"}.png` });
    let funnel = null;
    if (path !== "/" && !["/privacy","/terms","/ccpa","/do-not-sell"].includes(path)) {
      try {
        await stepThroughFunnel(page);
        funnel = await audit(page, path + " (engaged)");
        await page.screenshot({ path: `${OUT}/${p.name}_${path.replace(/\W+/g, "_")}_engaged.png` });
      } catch (e) {}
    }
    const fail = top.hScroll || top.offenders.length || (funnel && (funnel.hScroll || funnel.offenders.length || funnel.stickyOverlapsForm));
    results.push({ profile: p.name, path, fail: !!fail, top, funnel });
    console.log(`${fail ? "FAIL" : "ok  "} ${p.name} ${path}` +
      (top.hScroll ? " [hScroll]" : "") +
      (top.offenders.length ? ` [overflow: ${top.offenders.join(", ")}]` : "") +
      (funnel && funnel.stickyOverlapsForm ? " [sticky overlaps form]" : ""));
  }
  await ctx.close();
}
await browser.close();
const fails = results.filter((r) => r.fail);
console.log(`\n${fails.length ? "❌" : "✅"} ${results.length} checks, ${fails.length} failures. Screenshots in ${OUT}/`);
process.exit(fails.length ? 1 : 0);
