const { test, expect } = require("@playwright/test");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ARTIFACTS = "/opt/cursor/artifacts";
const FORMSUBMIT = "https://formsubmit.co/ajax/executive.wilsonwong@gmail.com";
const SCRIPT = "https://script.google.com/macros/s/test/exec";
const LIVE = "https://script.google.com/macros/s/AKfycbz7y4ouQXVG8HG8UwclTc5SEWTlcmdhiiikSKHdXpzniyRA1nn0hU4zyJgkJG-XC3O7Zg/exec";
const WORD_BLOCK = "Let's pick a word that lifts you up. Please choose a positive word.";
const STATEMENT_BLOCK = "Let's keep this uplifting. Please rephrase anything harsh.";
const NAME_BLOCK = "Let's use a first name that can sit beside your word.";
const EXAMPLE = "Example: Wilson's 2026 WOTY is CELEBRATE. To celebrate my community, relationships and my personal wins no matter how big or small they are.";
const HELP = "A word that will inspire you when you're feeling down, and a word that will humble you when you're being overzealous.";
const MISSION = "To show up for the people I love, especially on ordinary days.";
const VISION = "A year from now I am proud of how I treated people.";

async function shot(page, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await pauseMarquee(page);
  const height = await page.evaluate(() => {
    const header = document.getElementById("site-header");
    if (header) header.style.position = "absolute";
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  });
  const width = page.viewportSize().width;
  await page.setViewportSize({ width: width, height: Math.min(height + 40, 2400) });
  await page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: false });
  await page.setViewportSize({ width: width, height: width === 390 ? 844 : 1000 });
  await page.evaluate(() => {
    const header = document.getElementById("site-header");
    if (header) header.style.position = "";
  });
}

async function noSidewaysScroll(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

async function pauseMarquee(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    document.querySelectorAll(".woty-track").forEach((el) => {
      el.style.animation = "none";
      el.style.transform = "none";
    });
  });
}

async function blockLive(page) {
  await page.route(LIVE + "**", async (route) => {
    if (route.request().method() === "POST") {
      throw new Error("Refusing to post a test entry to the live Word of the Year endpoint");
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, entries: [] })
    });
  });
}

async function openWoty(page, width, options) {
  if (!options || options.blockLive !== false) await blockLive(page);
  await page.setViewportSize({ width: width, height: width === 390 ? 844 : 1000 });
  await page.goto("/woty/");
  await expect(page.locator("#woty-form")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("h1")).toHaveText("Word of the Year");
  await pauseMarquee(page);
}

test("word lists in Apps Script match the shared files", () => {
  const root = path.join(__dirname, "..");
  const json = fs.readFileSync(path.join(root, "assets/data/woty-words.json"), "utf8").trim();
  const screen = fs.readFileSync(path.join(root, "assets/js/woty-screen.js"), "utf8").trim();
  const gs = fs.readFileSync(path.join(root, "backend/woty-apps-script/Code.gs"), "utf8");
  function between(start, end) {
    const a = gs.indexOf(start);
    const b = gs.indexOf(end);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    return gs.slice(a + start.length, b).trim();
  }
  expect(between("/* WOTY_SCREEN_START */", "/* WOTY_SCREEN_END */")).toBe(screen);
  expect(between("/* WOTY_WORDS_START */", "/* WOTY_WORDS_END */")).toBe(json);
  const lists = JSON.parse(json);
  for (const word of ["power", "control", "dominate", "ruthless", "savage", "beast", "money", "rich", "sexy"]) {
    expect(lists.review).toContain(word);
  }
  for (const word of ["hate", "revenge", "kill", "destroy", "die", "worthless"]) {
    expect(lists.negative).toContain(word);
  }
  expect(gs).toContain('reason !== "profanity" && reason !== "negative"');
  expect(gs).toContain('setBackground("#f4c7c3")');
  expect(gs).toContain("CacheService.getScriptCache()");
  expect(gs).toContain('action === "list"');
  expect(gs).toContain("MailApp.sendEmail");
  expect(gs).toContain("data.company || data.website || data._honey");
  expect(gs).toContain('"Flagged"');
  expect(gs).toContain('"Hidden"');
  expect(gs).toContain('"Show publicly"');
  const listFn = gs.slice(gs.indexOf("function listPublic_"), gs.indexOf("function submissions_"));
  expect(listFn).not.toContain("row[2]");
  expect(listFn).toContain("isFlagged_");
  expect(listFn).toContain("firstName");
  expect(gs).toContain("Utilities.newBlob");
  expect(gs).toContain("application/pdf");
  const js = fs.readFileSync(path.join(root, "assets/js/woty.js"), "utf8");
  expect(js).toContain('var WOTY_ENDPOINT = "' + LIVE + '";');
  const post = js.slice(js.indexOf("function postScript"), js.indexOf("function postForm"));
  expect(post).toContain('method: "POST"');
  expect(post).toContain("body: JSON.stringify");
  expect(post).not.toMatch(/headers\s*:/);
  expect(post).not.toMatch(/redirect\s*:/);
  const list = js.slice(js.indexOf("function loadList"), js.indexOf("var motion"));
  expect(list).toContain("action=list");
  expect(list).not.toMatch(/redirect\s*:/);
});

test("screening blocks harsh words and lets ordinary words through", async ({ page }) => {
  await openWoty(page, 1280);
  const result = await page.evaluate(() => {
    const clean = ["classic", "hello", "skill", "diet", "grape", "cocktail", "passion", "ambassador", "heel", "good", "Niger", "spicy", "class", "assessment", "therapist", "document", "analysis", "deadline", "P.S. thanks", "self-love", "sit", "white"];
    const profanity = ["fuck", "fck", "f*ck", "f**k", "fuuuuck", "sh1t", "sh*t", "a$$", "f u c k", "bullshit", "spic"];
    const negative = ["hate", "h@te", "kill", "k1ll", "k-i-l-l", "k i l l", "destroy", "die", "worthless", "revenge", "I will kill the doubt"];
    const ambiguous = ["power", "control", "dominate", "ruthless", "savage", "beast", "money", "rich", "sexy", "self-control", "toxic"];
    const classify = (text) => window.wotyDebug.classify(text);
    return {
      clean: clean.map((text) => [text, classify(text)]),
      profanity: profanity.map((text) => [text, classify(text)]),
      negative: negative.map((text) => [text, classify(text)]),
      ambiguous: ambiguous.map((text) => [text, classify(text)]),
      richName: window.wotyDebug.submission({ firstName: "Rich", word: "CELEBRATE", mission: "Be kind.", vision: "Stay close." }),
      powerWord: window.wotyDebug.submission({ firstName: "Ada", word: "power", mission: "Be kind.", vision: "Stay close." }),
      badName: window.wotyDebug.submission({ firstName: "F*ck", word: "CELEBRATE", mission: "Be kind.", vision: "Stay close." })
    };
  });
  for (const [text, got] of result.clean) expect(got, text).toBe("");
  for (const [text, got] of result.profanity) expect(got, text).toBe("profanity");
  for (const [text, got] of result.negative) expect(got, text).toBe("negative");
  for (const [text, got] of result.ambiguous) expect(got, text).toBe("ambiguous");
  expect(result.richName).toBe("");
  expect(result.powerWord).toBe("ambiguous");
  expect(result.badName).toBe("profanity");
});

test("step flow, validation, and blocking", async ({ page }) => {
  let calls = 0;
  let payload = null;
  await page.addInitScript(() => { window.__WOTY_ENDPOINT = ""; });
  await page.route("https://formsubmit.co/**", async (route) => {
    calls += 1;
    payload = JSON.parse(route.request().postData() || "{}");
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).toBe(FORMSUBMIT);
    expect(route.request().headers()["content-type"] || "").toContain("application/json");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "true" }) });
  });

  await openWoty(page, 1280);
  await expect(page.locator("#woty-help")).toHaveText(HELP);
  await expect(page.locator("#woty-example")).toHaveText(EXAMPLE);
  await expect(page.locator(".woty-card[data-example='true']").first()).toContainText("CELEBRATE");
  await expect(page.locator(".woty-card[data-example='true']").first()).toContainText("Wilson");
  await expect(page.locator(".woty-card[data-example='true']").first()).toContainText("To celebrate my community, relationships and my personal wins no matter how big or small they are.");
  await expect(page.locator("#woty-marquee")).not.toContainText("@");
  const hrefs = await page.locator("header a, footer a").evaluateAll((els) => els.map((a) => a.getAttribute("href") || ""));
  expect(hrefs.some((href) => href.toLowerCase().includes("woty"))).toBe(false);
  await expect(page.locator("#dd-launcher")).toBeVisible();
  await expect(page.locator('link[href="/assets/css/styles.css"]')).toHaveCount(1);
  await expect(page.locator('link[href*="Fraunces"]')).toHaveCount(1);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe("rgb(246, 240, 227)");
  await page.mouse.move(0, 0);
  const buttonBg = await page.locator("#woty-next-1").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(buttonBg).toBe("rgb(47, 107, 79)");
  await noSidewaysScroll(page);
  await shot(page, "woty-1280-step1.png");

  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-word-error")).toHaveText("Enter one word.");
  expect(calls).toBe(0);

  await page.locator("#woty-word").fill("A".repeat(21));
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-word-error")).toHaveText("Keep your word to 20 characters.");

  await page.locator("#woty-word").fill("hello!");
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-word-error")).toHaveText("Use one word made of letters and hyphens.");

  for (const word of ["kill", "k1ll", "k-i-l-l", "k i l l", "fuuuuck", "sh1t", "sh*t", "hate", "worthless", "destroy"]) {
    await page.locator("#woty-word").fill(word);
    await page.locator("#woty-next-1").click();
    await expect(page.locator("#woty-word-error")).toHaveText(WORD_BLOCK);
    await expect(page.locator("#woty-step-2")).toBeHidden();
  }
  await shot(page, "woty-1280-blocked.png");
  expect(calls).toBe(0);

  await page.locator("#woty-word").fill("Steady");
  await page.locator("#woty-name").fill("F*ck");
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-name-error")).toHaveText(NAME_BLOCK);

  await page.locator("#woty-name").fill("Rich");
  await page.locator("#woty-word").fill("power");
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-step-2")).toBeVisible();
  await page.locator("#woty-back-2").click();
  await expect(page.locator("#woty-word")).toHaveValue("power");

  await page.locator("#woty-word").fill("Steady");
  await page.locator("#woty-name").fill("Avery");
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-step-2")).toBeVisible();
  await expect(page.locator("#woty-progress li").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(page.locator("#woty-progress li").nth(0)).toHaveClass(/is-done/);
  await page.locator("#woty-next-2").click();
  await expect(page.locator("#woty-mission-error")).toHaveText("Add a mission statement.");
  await expect(page.locator("#woty-vision-error")).toHaveText("Add a vision statement.");

  await page.locator("#woty-mission").fill("I will kill the doubt");
  await page.locator("#woty-vision").fill(VISION);
  await page.locator("#woty-next-2").click();
  await expect(page.locator("#woty-mission-error")).toHaveText(STATEMENT_BLOCK);
  await expect(page.locator("#woty-step-3")).toBeHidden();

  await page.locator("#woty-mission").fill(MISSION);
  await expect(page.locator("#woty-mission-count")).toHaveText(MISSION.length + " / 300");
  await expect(page.locator("#woty-mission")).toHaveAttribute("maxlength", "300");
  await expect(page.locator("#woty-vision")).toHaveAttribute("maxlength", "300");
  await pauseMarquee(page);
  await noSidewaysScroll(page);
  await shot(page, "woty-1280-step2.png");
  await page.locator("#woty-next-2").click();

  await expect(page.locator("#woty-step-3")).toBeVisible();
  await expect(page.locator("#woty-community")).toBeHidden();
  await expect(page.locator("#woty-public")).toBeChecked();
  await expect(page.locator(".woty-check span")).toHaveText("Show my word and statements in the community scroll (first name only).");
  await expect(page.locator("#woty-submit")).toHaveText("Email me my WOTY");
  await expect(page.locator("#woty-email-help")).toHaveText("Wilson receives this with your word. You'll download the PDF on the next screen.");
  await shot(page, "woty-1280-step3.png");

  await page.locator("#woty-submit").click();
  await expect(page.locator("#woty-email-error")).toHaveText("Add an email address.");
  expect(calls).toBe(0);
  await page.locator("#woty-email").fill("not-an-email");
  await page.locator("#woty-submit").click();
  await expect(page.locator("#woty-email-error")).toHaveText("Add an email address.");
  expect(calls).toBe(0);

  await page.locator("#woty-email").fill("avery@example.com");
  await page.locator("#woty-company").fill("bot", { force: true });
  await page.locator("#woty-submit").click();
  await expect(page.locator("#woty-step-3")).toBeVisible();
  expect(calls).toBe(0);
  await page.locator("#woty-company").fill("", { force: true });

  await page.locator("#woty-back-3").click();
  await expect(page.locator("#woty-mission")).toHaveValue(MISSION);
  await page.locator("#woty-next-2").click();
  await page.locator("#woty-submit").click();

  await expect(page.locator("#woty-thanks")).toBeVisible();
  await expect(page.locator("#woty-preview-kicker")).toHaveText("Avery's 2026 Word of the Year");
  await expect(page.locator("#woty-preview-word")).toHaveText("STEADY");
  await expect(page.locator("#woty-preview-mission")).toHaveText(MISSION);
  await expect(page.locator("#woty-preview-vision")).toHaveText(VISION);
  await expect(page.locator("#woty-inbox")).toHaveText("Wilson has your word. Download your printable PDF here.");
  await expect(page.locator("#woty-download")).toHaveText("Download PDF");
  await expect(page.locator("#woty-community")).toBeVisible();
  await expect(page.locator("#woty-progress .is-done")).toHaveCount(3);
  await pauseMarquee(page);
  await noSidewaysScroll(page);
  await shot(page, "woty-1280-thanks.png");
  expect(calls).toBe(1);
  expect(payload._template).toBe("table");
  expect(payload._captcha).toBe(false);
  expect(payload._honey).toBe("");
  expect(payload._replyto).toBe("avery@example.com");
  expect(payload["First name"]).toBe("Avery");
  expect(payload.Email).toBe("avery@example.com");
  expect(payload.Word).toBe("STEADY");
  expect(payload.Mission).toBe(MISSION);
  expect(payload.Vision).toBe(VISION);
  expect(payload["Show publicly"]).toBe("TRUE");
  expect(payload.Page).toContain("woty");
  expect(payload._subject).toContain("STEADY");
  expect(JSON.stringify(payload).toLowerCase()).not.toContain("card number");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#woty-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("steady-2026-word-of-the-year.pdf");
  const pdfPath = path.join(ARTIFACTS, "woty-sample.pdf");
  await download.saveAs(pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(1000);
});

test("mobile steps stay on the page and out of the nav", async ({ page }) => {
  await page.addInitScript(() => { window.__WOTY_ENDPOINT = ""; });
  await page.route("https://formsubmit.co/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "true" }) });
  });
  await openWoty(page, 390);
  await noSidewaysScroll(page);
  await shot(page, "woty-390-step1.png");

  await page.locator("#woty-word").fill("Steady");
  await page.locator("#woty-name").fill("Avery");
  await page.locator("#woty-next-1").click();
  await expect(page.locator("#woty-example")).toBeVisible();
  await pauseMarquee(page);
  await noSidewaysScroll(page);
  await shot(page, "woty-390-step2.png");

  await page.locator("#woty-mission").fill(MISSION);
  await page.locator("#woty-vision").fill(VISION);
  await page.locator("#woty-next-2").click();
  await expect(page.locator("#woty-submit")).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, "woty-390-step3.png");

  await page.locator("#woty-email").fill("avery@example.com");
  await page.locator("#woty-submit").click();
  await expect(page.locator("#woty-preview-word")).toHaveText("STEADY");
  await pauseMarquee(page);
  await noSidewaysScroll(page);
  await shot(page, "woty-390-thanks.png");

  await page.locator("#menu-toggle").click();
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#nav-links a[href*='woty']")).toHaveCount(0);
  await expect(page.locator("#nav-links a[href='/speaking.html']")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("Apps Script endpoint posts text and lists public words only", async ({ page }) => {
  let posted = null;
  let contentType = "";
  await page.addInitScript((url) => { window.__WOTY_ENDPOINT = url; }, SCRIPT);
  await page.route("https://script.google.com/macros/s/test/exec**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      expect(request.url()).toContain("action=list");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          entries: [{
            firstName: "Ada",
            word: "SHINE",
            mission: "Be kind to people.",
            vision: "A steadier year.",
            email: "ada@secret.example"
          }]
        })
      });
      return;
    }
    contentType = request.headers()["content-type"] || "";
    posted = JSON.parse(request.postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, emailed: true, flagged: "ambiguous" })
    });
  });
  await page.route("https://formsubmit.co/**", async (route) => {
    throw new Error("FormSubmit should not be used when WOTY_ENDPOINT is set");
  });

  await openWoty(page, 1280);
  await expect(page.locator(".woty-card-word").filter({ hasText: "SHINE" }).first()).toBeVisible();
  await expect(page.locator(".woty-card-word").filter({ hasText: "CELEBRATE" }).first()).toBeVisible();
  await expect(page.locator("#woty-marquee")).not.toContainText("ada@secret.example");
  await expect(page.locator("#woty-email-help")).toHaveText("Wilson sends the printable page to this address.");
  const endpoint = await page.evaluate(() => window.wotyDebug.endpoint);
  expect(endpoint).toBe(SCRIPT);

  await page.locator("#woty-word").fill("power");
  await page.locator("#woty-name").fill("Ada");
  await page.locator("#woty-next-1").click();
  await page.locator("#woty-mission").fill("I want more money and control.");
  await page.locator("#woty-vision").fill("A generous year.");
  await page.locator("#woty-next-2").click();
  await page.locator("#woty-public").uncheck();
  await page.locator("#woty-email").fill("ada@example.com");
  await page.locator("#woty-submit").click();
  await expect(page.locator("#woty-inbox")).toHaveText("Check your inbox for your printable PDF.");
  await expect(page.locator("#woty-preview-word")).toHaveText("POWER");
  expect(contentType).toContain("text/plain");
  expect(posted.word).toBe("POWER");
  expect(posted.firstName).toBe("Ada");
  expect(posted.email).toBe("ada@example.com");
  expect(posted.mission).toBe("I want more money and control.");
  expect(posted.vision).toBe("A generous year.");
  expect(posted.showPublic).toBe(false);
  expect(posted.company).toBe("");
});

test("the scroll pauses on hover and respects reduced motion", async ({ page }) => {
  await blockLive(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/woty/");
  await expect(page.locator("#woty-form")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".woty-set")).toHaveCount(2);
  const running = () => page.locator(".woty-track").evaluate((el) => getComputedStyle(el).animationPlayState);
  await expect.poll(running).toBe("running");
  await page.hover("#woty-marquee");
  await expect.poll(running).toBe("paused");
  await noSidewaysScroll(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/woty/");
  await expect(page.locator("#woty-form")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".woty-set")).toHaveCount(1);
  await expect(page.locator(".woty-card[data-example='true']")).toContainText("CELEBRATE");
  const reduced = await page.locator(".woty-track").evaluate((el) => getComputedStyle(el).animationName);
  expect(reduced === "none" || reduced === "").toBe(true);
  await noSidewaysScroll(page);
});

test("deployed endpoint follows the Apps Script redirect and emails the PDF", async ({ page }) => {
  const redirect = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const afterPost = req.url.indexOf("posted=1") !== -1;
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      res.end(JSON.stringify(afterPost ? { ok: true, emailed: true, flagged: "" } : { ok: true, entries: [] }));
    });
    server.listen(0, "127.0.0.1", () => resolve({ server: server, port: server.address().port }));
  });
  let posted = null;
  let contentType = "";
  try {
  await page.route(LIVE + "**", async (route) => {
    const request = route.request();
    const postedHop = request.method() === "POST";
    if (!postedHop) expect(request.url()).toContain("action=list");
    if (postedHop) {
      contentType = request.headers()["content-type"] || "";
      expect(contentType).toMatch(/^text\/plain\b/i);
      expect(contentType).not.toContain("application/json");
      expect(request.headers()["authorization"]).toBeUndefined();
      const accept = request.headers()["accept"] || "";
      expect(accept).not.toContain("application/json");
      posted = JSON.parse(request.postData() || "{}");
    }
    await route.fulfill({
      status: 302,
      headers: {
        location: "http://127.0.0.1:" + redirect.port + (postedHop ? "/posted=1" : "/list"),
        "access-control-allow-origin": "*"
      }
    });
  });
  await page.route("https://formsubmit.co/**", async () => {
    throw new Error("FormSubmit should not be used when the Apps Script endpoint is set");
  });

  await openWoty(page, 1280, { blockLive: false });
  const words = await page.locator(".woty-card-word").allTextContents();
  expect(words.length).toBeGreaterThan(0);
  expect(words.every((word) => word.trim() === "CELEBRATE")).toBe(true);
  await expect(page.locator(".woty-card[data-example='true']").first()).toContainText("Wilson");
  const endpoint = await page.evaluate(() => window.wotyDebug.endpoint);
  expect(endpoint).toBe(LIVE);

  await page.locator("#woty-word").fill("Steady");
  await page.locator("#woty-name").fill("Avery");
  await page.locator("#woty-next-1").click();
  await page.locator("#woty-mission").fill(MISSION);
  await page.locator("#woty-vision").fill(VISION);
  await page.locator("#woty-next-2").click();
  await expect(page.locator("#woty-email-help")).toHaveText("Wilson sends the printable page to this address.");
  await page.locator("#woty-email").fill("avery@example.com");
  await page.locator("#woty-submit").click();

  await expect(page.locator("#woty-thanks")).toBeVisible();
  await expect(page.locator("#woty-inbox")).toHaveText("Check your inbox for your printable PDF.");
  await expect(page.locator("#woty-download")).toBeVisible();
  await expect(page.locator("#woty-download")).toHaveText("Download PDF");
  await expect(page.locator("#woty-preview-word")).toHaveText("STEADY");
  expect(contentType).toMatch(/^text\/plain\b/i);
  expect(posted.word).toBe("STEADY");
  expect(posted.email).toBe("avery@example.com");
  expect(posted.firstName).toBe("Avery");
  expect(posted.showPublic).toBe(true);
  } finally {
    await new Promise((resolve) => redirect.server.close(resolve));
  }
});

test("/woty without a trailing slash still opens the page", async ({ page }) => {
  await blockLive(page);
  await page.goto("/woty");
  await expect(page).toHaveURL(/\/woty\/?$/);
  await expect(page.locator("h1")).toHaveText("Word of the Year");
  await expect(page.locator("#woty-form")).toHaveAttribute("data-ready", "true");
});
