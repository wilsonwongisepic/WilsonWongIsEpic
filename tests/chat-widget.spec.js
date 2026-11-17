const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ARTIFACTS = "/opt/cursor/artifacts";
const GREETING = "What are you looking for today? Are you looking for access to Wilson? Or are you looking for public speaking? Are you looking for coaching? Or most importantly, are you looking for closing gifts?";
const WILSON_NOTE = "That's Wilson's department. Leave your name and how to reach you, and I'll let Wilson know so he can get back to you.";
const FORMSUBMIT = "https://formsubmit.co/ajax/executive.wilsonwong@gmail.com";

const PAGES = ["/", "/speaking.html", "/coaching.html", "/closing-gifts.html", "/about.html", "/contact.html", "/sharp/"];

function shot(page, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: false });
}

async function noSidewaysScroll(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

async function openChat(page) {
  await page.locator("#dd-launcher").click();
  await expect(page.locator("#dd-panel")).toBeVisible();
  await expect(page.locator("#dd-launcher")).toHaveAttribute("aria-expanded", "true");
}

async function clearOf(page, selector) {
  await expect.poll(async () => page.evaluate((sel) => {
    const obstacle = document.querySelector(sel);
    const launcher = document.querySelector(".dd-launcher");
    if (!obstacle || !launcher) return false;
    const o = obstacle.getBoundingClientRect();
    const l = launcher.getBoundingClientRect();
    if (o.width < 1 || o.height < 1) return false;
    const hits = l.left < o.right && l.right > o.left && l.top < o.bottom && l.bottom > o.top;
    return !hits && l.bottom <= o.top - 8;
  }, selector)).toBe(true);
}

test("Dee Dee is on every page and stays rule-based", async ({ page }) => {
  const src = fs.readFileSync(path.join(__dirname, "../assets/js/chat-widget.js"), "utf8");
  expect(src).toMatch(/var CHAT_ENDPOINT = ""/);
  expect(src).toMatch(/function getReply\(/);
  expect(src).not.toMatch(/api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]/i);

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const href of PAGES) {
    await page.goto(href);
    await expect(page.locator("#dd-launcher")).toBeVisible();
    await expect(page.locator("#dd-launcher")).toHaveText("DD");
    await expect(page.locator("#dd-panel")).toBeHidden();
  }
});

test("desktop home: greeting, choices, gifts follow-up, and order steps", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await openChat(page);
  await expect(page.getByRole("heading", { name: "Dee Dee" })).toBeVisible();
  await expect(page.locator(".dd-role")).toHaveText("Wilson's closing-gifts assistant");
  await expect(page.locator(".dd-avatar")).toHaveText("DD");
  await expect(page.locator(".dd-panel img")).toHaveCount(0);
  await expect(page.locator("#dd-greeting")).toHaveText(GREETING);
  await expect(page.locator("#dd-replies button")).toHaveText([
    "Access to Wilson",
    "Public speaking",
    "Coaching",
    "Closing gifts"
  ]);

  const primary = page.locator("#dd-replies .dd-primary");
  const plain = page.locator("#dd-replies .dd-reply").first();
  await expect(primary).toHaveText("Closing gifts");
  const primaryBg = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
  const plainBg = await plain.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(primaryBg).toBe("rgb(47, 107, 79)");
  expect(plainBg).not.toBe(primaryBg);
  await noSidewaysScroll(page);
  await shot(page, "chat-home-open-1280.png");

  await page.getByRole("button", { name: "Closing gifts", exact: true }).click();
  await expect(page.locator(".dd-user").last()).toContainText("Closing gifts");
  const gifts = page.locator(".dd-live .dd-bot").last();
  await expect(gifts).toContainText("Wilson Wong is an independent Cutco representative.");
  await expect(gifts).toContainText("Prices stay hidden until we know who the quote is for.");
  await expect(gifts).not.toContainText("$");
  await expect(page.locator("#dd-replies button")).toHaveText([
    "Build my gift quote",
    "See gift packages",
    "How does ordering work?",
    "Ask a question"
  ]);
  await expect(page.locator("#dd-replies .dd-primary")).toHaveText("Build my gift quote");
  await shot(page, "chat-home-gifts-1280.png");

  await page.getByRole("button", { name: "How does ordering work?" }).click();
  const steps = page.locator(".dd-steps").last();
  await expect(steps.locator("strong")).toHaveText([
    "Find your Cutco gift",
    "Place your order",
    "Approve your proof",
    "Receive your gifts",
    "Grab, go, give"
  ]);
  await expect(steps).toContainText("Browse and pick the gifts you love, 6 or more, mixed and matched however you like.");
  await expect(steps).toContainText("Wilson calls to confirm your gifts and engraving and share any current deals.");
  await expect(steps).toContainText("Your invoice and engraving proof arrive in your inbox within a few business days.");
  await expect(steps).toContainText("Your whole order arrives at once within 30 days, delivered to your office and signed for, with tracking emailed when it's on its way.");
  await expect(steps).toContainText("Hand your client a gift they'll use for a lifetime. Every time they reach for it, your appreciation lasts forever.");
  await expect(steps).not.toContainText("$");
  await page.evaluate(() => {
    const panel = document.querySelector(".dd-panel");
    const log = document.querySelector("#dd-log");
    document.querySelector("#dd-replies").hidden = true;
    document.querySelector(".dd-composer").style.display = "none";
    panel.style.maxHeight = "780px";
    log.style.maxHeight = "680px";
    const bubble = log.querySelector(".dd-steps").closest(".dd-bubble");
    log.scrollTop = bubble.offsetTop;
  });
  await page.locator(".dd-panel").screenshot({ path: path.join(ARTIFACTS, "chat-steps-1280.png") });
});

test("quote opens in a new tab and packages go to closing gifts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await openChat(page);
  await page.getByRole("button", { name: "Closing gifts", exact: true }).click();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Build my gift quote" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup).toHaveURL(/\/sharp\/?$/);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText("Opening the gift quote in a new tab.");
  await popup.close();

  await page.getByRole("button", { name: "See gift packages" }).click();
  await expect(page).toHaveURL(/\/closing-gifts\.html$/);
});

test("speaking, coaching, and access let Wilson know", async ({ page }) => {
  let payload = null;
  await page.route("https://formsubmit.co/**", async (route) => {
    payload = JSON.parse(route.request().postData() || "{}");
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).toBe(FORMSUBMIT);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" })
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openChat(page);
  await page.getByRole("button", { name: "Access to Wilson" }).click();
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText(WILSON_NOTE);
  await expect(page.locator("#dd-topic")).toHaveValue("access");
  await expect(page.locator('.dd-bubble a[href="/contact.html"]')).toBeVisible();

  await page.evaluate(() => sessionStorage.setItem("ww-dd-open", "0"));
  await page.goto("/");
  await openChat(page);
  await page.getByRole("button", { name: "Coaching", exact: true }).click();
  await expect(page.locator("#dd-topic")).toHaveValue("coaching");
  await expect(page.locator('.dd-bubble a[href="/coaching.html"]')).toBeVisible();
  await page.getByRole("button", { name: "Send to Wilson" }).click();
  await expect(page.locator("#dd-form-error")).toHaveText("Add your name.");
  expect(payload).toBeNull();

  await page.locator("#dd-name").fill("Ada");
  await page.locator("#dd-contact").fill("ada@example.com");
  await page.locator("#dd-message").fill("Saturday morning works.");
  await page.mouse.move(0, 0);
  const sendBg = await page.getByRole("button", { name: "Send to Wilson" }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(sendBg).toBe("rgb(47, 107, 79)");
  await shot(page, "chat-form-390.png");
  await page.getByRole("button", { name: "Send to Wilson" }).click();
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText("Thanks! I've let Wilson know.");
  expect(payload._subject).toBe("Website chat: Coaching enquiry from Ada");
  expect(payload._template).toBe("table");
  expect(payload._captcha).toBe(false);
  expect(payload._replyto).toBe("ada@example.com");
  expect(payload.topic).toBe("coaching");
  expect(payload.Name).toBe("Ada");
  expect(payload["Email or phone"]).toBe("ada@example.com");
  expect(payload.Message).toBe("Saturday morning works.");
  expect(payload.Page).toBe("/");
  await noSidewaysScroll(page);
});

test("typed messages follow keywords or ask Wilson", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/speaking.html");
  await openChat(page);

  await page.locator("#dd-input").fill("What is the price of a gift?");
  await page.locator("#dd-input").press("Enter");
  await expect(page.getByRole("button", { name: "Build my gift quote" })).toBeVisible();
  await expect(page.locator("#dd-form")).toBeHidden();

  await page.locator("#dd-input").fill("Book a keynote");
  await page.locator("#dd-input").press("Enter");
  await expect(page.locator("#dd-topic")).toHaveValue("speaking");
  await expect(page.locator('.dd-bubble a[href="/speaking.html"]').last()).toBeVisible();

  await page.locator("#dd-input").fill("just saying hello");
  await page.locator("#dd-input").press("Enter");
  await expect(page.locator("#dd-topic")).toHaveValue("other");
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText("I'll let Wilson know so he can get back to you.");
  await expect(page.locator(".dd-live .dd-bot").last()).not.toContainText("That's Wilson's department");
});

test("closing gifts question uses the same form", async ({ page }) => {
  let payload = null;
  await page.route("https://formsubmit.co/**", async (route) => {
    payload = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" })
    });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/closing-gifts.html");
  await openChat(page);
  await page.getByRole("button", { name: "Closing gifts", exact: true }).click();
  await page.getByRole("button", { name: "Ask a question" }).click();
  await expect(page.locator("#dd-topic")).toHaveValue("closing-gifts");
  await page.locator("#dd-name").fill("Sam");
  await page.locator("#dd-contact").fill("7809150982");
  await page.getByRole("button", { name: "Send to Wilson" }).click();
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText("Thanks! I've let Wilson know.");
  expect(payload._subject).toBe("Website chat: Closing gifts question from Sam");
  expect(payload.topic).toBe("closing-gifts");
  expect(payload["Email or phone"]).toBe("7809150982");
  expect(payload._replyto).toBeUndefined();

  await page.getByRole("button", { name: "Closing gifts", exact: true }).click();
  await page.getByRole("button", { name: "See gift packages" }).click();
  await expect(page.locator(".dd-live .dd-bot").last()).toContainText("You're on the closing gifts page.");
  await expect(page).toHaveURL(/\/closing-gifts\.html$/);
});

test("keyboard: focus trap and escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("#dd-launcher").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".dd-close")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".dd-send")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".dd-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dd-panel")).toBeHidden();
  await expect(page.locator("#dd-launcher")).toBeFocused();
  await expect(page.locator("#dd-launcher")).toHaveAttribute("aria-expanded", "false");
});

test("open state and the one-time nudge stay in the tab", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("#dd-launcher")).toHaveClass(/is-nudging/);
  await page.goto("/about.html");
  await expect(page.locator("#dd-launcher")).not.toHaveClass(/is-nudging/);

  await openChat(page);
  await page.reload();
  await expect(page.locator("#dd-panel")).toBeVisible();
  await page.locator(".dd-close").click();
  await page.reload();
  await expect(page.locator("#dd-panel")).toBeHidden();
});

test("reduced motion skips the nudge", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("#dd-launcher")).not.toHaveClass(/is-nudging/);
  const name = await page.locator("#dd-launcher").evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

test("mobile home and closing gifts keep the launcher clear of the quote bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openChat(page);
  await noSidewaysScroll(page);
  await shot(page, "chat-home-open-390.png");
  await page.keyboard.press("Escape");

  await page.locator(".doors").scrollIntoViewIfNeeded();
  await expect(page.locator("a.fab")).toBeVisible();
  await clearOf(page, "a.fab");

  await page.goto("/closing-gifts.html");
  await page.locator(".gifts-grid").scrollIntoViewIfNeeded();
  await expect(page.locator("#gift-sticky")).not.toHaveClass(/is-hidden/);
  await expect(page.locator("#gift-sticky")).toBeVisible();
  await clearOf(page, "#gift-sticky");
  await noSidewaysScroll(page);
  await shot(page, "chat-gifts-sticky-390.png");

  await openChat(page);
  await clearOf(page, "#gift-sticky");
  await noSidewaysScroll(page);
  await shot(page, "chat-gifts-open-390.png");
});

test("on the quote page the launcher sits above the tray", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sharp/");
  await expect(page.locator("#dd-launcher")).toBeVisible();
  await page.locator("#choose-realtor").click();
  await expect(page.locator("body")).toHaveClass(/browsing/);
  await expect(page.locator("#continue-details")).toBeVisible();
  await clearOf(page, "#tray");
  await clearOf(page, "#continue-details");
  await noSidewaysScroll(page);
  await shot(page, "chat-sharp-tray-390.png");
});
