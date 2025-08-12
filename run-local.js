// Run QUnit in local Chrome and Safari
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const safari = require("selenium-webdriver/safari");

const TEST_URL = process.env.TEST_URL || "http://localhost:8080/test/index.html";

const targets = [
  {
    name: "Chrome local",
    build: () => new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options())
  },
  {
    name: "Safari local",
    build: () => new Builder().forBrowser("safari").setSafariOptions(new safari.Options())
  }
];

async function waitForQUnit(driver, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const title = await driver.getTitle();
      if (title === "QUNIT_PASSED" || title === "QUNIT_FAILED") {
        const res = await driver.executeScript("return window.__qunit__ || null");
        return res || { failed: title === "QUNIT_FAILED" ? 1 : 0, total: "n/a" };
      }
      const has = await driver.executeScript("return !!window.__qunit__");
      if (has) return await driver.executeScript("return window.__qunit__");
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for QUnit results");
}

async function runOne(target) {
  let driver;
  try {
    driver = await target.build().build();
    await driver.get(TEST_URL);
    const results = await waitForQUnit(driver);
    const ok = results.failed === 0;

    console.log(`[${target.name}] QUnit results:`, results);

    // 👀 Wait 10 seconds before closing so you can see the results in the browser
    console.log(`Keeping ${target.name} open for 10 seconds...`);
    await new Promise(r => setTimeout(r, 10000));

    return { browser: target.name, ok, results };
  } catch (err) {
    return { browser: target.name, ok: false, error: String(err) };
  } finally {
    if (driver) await driver.quit();
  }
}

(async () => {
  const results = [];
  for (const t of targets) {
    const r = await runOne(t);
    console.log(`[${t.name}]`, r);
    results.push(r);
  }
  const anyFail = results.some(r => !r.ok);
  process.exit(anyFail ? 1 : 0);
})();
