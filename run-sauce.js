// run-sauce.js
const { Builder } = require("selenium-webdriver");

const SAUCE_REGION = process.env.SAUCE_REGION || "eu-central-1"; // or us-west-1
const SAUCE_URL = `https://${process.env.SAUCE_USERNAME}:${process.env.SAUCE_ACCESS_KEY}` +
                  `@ondemand.${SAUCE_REGION}.saucelabs.com:443/wd/hub`;
const TEST_URL = process.env.TEST_URL || "http://eyalhost:8080/test/index.html";
const BUILD = process.env.BUILD || `qunit-${Date.now()}`;
const TUNNEL = process.env.SAUCE_TUNNEL || "eyalyovel_tunnel_name";
const WAIT_SECONDS = Number(process.env.WAIT_SECONDS || 10); // keep session open after results

const targets = [
  {
    name: "Chrome latest on macOS",
    caps: {
      browserName: "chrome",
      platformName: "macOS 14",
      browserVersion: "latest",
      "sauce:options": {
        name: "QUnit Chrome",
        build: BUILD,
        tunnelName: TUNNEL,
        armRequired: true
      }
    }
  },
  {
    name: "Safari latest on macOS",
    caps: {
      browserName: "safari",
      platformName: "macOS 14",
      browserVersion: "latest",
      "sauce:options": {
        name: "QUnit Safari",
        build: BUILD,
        tunnelName: TUNNEL,
        armRequired: true
      }
    }
  }
];

async function waitForQUnit(driver, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const title = await driver.getTitle();
    if (title === "QUNIT_PASSED" || title === "QUNIT_FAILED") {
      const res = await driver.executeScript("return window.__qunit__ || null");
      return res || { failed: title === "QUNIT_FAILED" ? 1 : 0, total: "n/a" };
    }
    const has = await driver.executeScript("return !!window.__qunit__");
    if (has) return await driver.executeScript("return window.__qunit__");
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for QUnit results");
}

async function runOne(target) {
  let driver;
  try {
    driver = await new Builder()
      .usingServer(SAUCE_URL)
      .withCapabilities(target.caps)
      .build();

    await driver.get(TEST_URL);

    const results = await waitForQUnit(driver);
    const ok = results.failed === 0;

    // set job result and add context
    try {
      await driver.executeScript(`sauce:job-result=${ok ? "passed" : "failed"}`);
      await driver.executeScript("sauce:context=" + JSON.stringify(results));
    } catch (_) {}

    // wait before closing so you can view the finished page in Sauce
    console.log(`[${target.name}] keeping session open for ${WAIT_SECONDS}s...`);
    await new Promise(r => setTimeout(r, WAIT_SECONDS * 1000));

    return { name: target.name, ok, results };
  } catch (err) {
    return { name: target.name, ok: false, error: String(err) };
  } finally {
    if (driver) await driver.quit();
  }
}

(async () => {
  const out = [];
  for (const t of targets) {
    const r = await runOne(t);
    console.log(`[${t.name}]`, r);
    out.push(r);
  }
  const anyFail = out.some(r => !r.ok);
  process.exit(anyFail ? 1 : 0);
})();
