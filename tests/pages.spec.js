const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ARTIFACTS = "/opt/cursor/artifacts";

const PAGES = [
  ["/", "home"],
  ["/speaking.html", "speaking"],
  ["/coaching.html", "coaching"],
  ["/closing-gifts.html", "gifts"],
  ["/about.html", "about"],
  ["/community.html", "community"],
  ["/sponsorship.html", "sponsorship"],
  ["/contact.html", "contact"]
];

async function noSidewaysScroll(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

async function shot(page, name, fullPage) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: !!fullPage });
}

test("nav points at separate pages and marks the current one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const hrefs = await page.locator(".nav-links a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual([
    "/speaking.html",
    "/coaching.html",
    "/closing-gifts.html",
    "/about.html",
    "/about.html#gallery",
    "/community.html",
    "/sponsorship.html",
    "/contact.html"
  ]);
  const footerHrefs = await page.locator(".site-footer .footer-grid > div").nth(1).locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
  expect(footerHrefs).toEqual([
    "/speaking.html",
    "/coaching.html",
    "/closing-gifts.html",
    "/about.html",
    "/about.html#gallery",
    "/community.html",
    "/sponsorship.html"
  ]);
  await expect(page.locator(".doors a")).toHaveCount(3);
  await expect(page.locator(".door-speak")).toHaveAttribute("href", "/speaking.html");
  await expect(page.locator(".door-coach")).toHaveAttribute("href", "/coaching.html");
  await expect(page.locator(".door-gifts")).toHaveAttribute("href", "/closing-gifts.html");
  await expect(page.locator(".door-gifts img")).toHaveAttribute("src", "images/photos/closing-gifts.webp");

  const current = {
    "/speaking.html": "Speaking",
    "/coaching.html": "Coaching",
    "/closing-gifts.html": "Closing Gifts",
    "/about.html": "About",
    "/community.html": "Community",
    "/sponsorship.html": "Sponsorship",
    "/contact.html": "Book Wilson"
  };
  for (const [href, label] of Object.entries(current)) {
    await page.goto(href);
    await expect(page.locator("nav a[aria-current='page']")).toHaveText(label);
    await expect(page.locator(".site-footer a[aria-current='page']")).toHaveText(label === "Closing Gifts" ? "Closing gifts" : label);
    const links = await page.locator(".nav-links a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(links.indexOf("/sponsorship.html")).toBe(links.indexOf("/community.html") + 1);
    const explore = await page.locator(".site-footer .footer-grid > div").nth(1).locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(explore.indexOf("/sponsorship.html")).toBe(explore.indexOf("/community.html") + 1);
    await expect(page.locator("title")).not.toHaveText("Wilson Wong — Speaker & Sales Coach");
    await noSidewaysScroll(page);
  }
});

test("community page lists the two hubs and upcoming events", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/community.html");
  await expect(page.locator("h1")).toHaveText("Community");
  await expect(page.locator(".cards.duo .card")).toHaveCount(2);
  const corgi = page.locator(".cards.duo .card").nth(0);
  await expect(corgi.locator("h3")).toHaveText("Corgi and cigars");
  await expect(corgi.locator("p")).toHaveText("If you have a dog and you enjoy cigars and a nice walk, you are more than welcome to come to the Terwilliger Dog Park.");
  const boa = page.locator(".hubs a").nth(0);
  const van = page.locator(".hubs a").nth(1);
  await expect(boa).toContainText("Boa and Hare");
  await expect(boa).toHaveAttribute("href", "https://boaandhare.ca");
  await expect(boa).toHaveAttribute("target", "_blank");
  await expect(boa).toHaveAttribute("rel", "noopener");
  await expect(van).toContainText("Van Loc");
  await expect(van).toHaveAttribute("href", "https://vanloc.ca");
  await expect(van).toHaveAttribute("target", "_blank");
  await expect(van).toHaveAttribute("rel", "noopener");
  await expect(page.getByRole("heading", { name: "Edmonton's Chinatown" })).toBeVisible();
  await expect(page.locator("#events h2")).toHaveText("Community events coming soon");
  await expect(page.locator("#events .lead")).toHaveText("Stay tuned for upcoming events.");
  const desktopCols = await page.locator(".cards.duo").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(desktopCols).toBe(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCols = await page.locator(".cards.duo").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(mobileCols).toBe(1);
  await noSidewaysScroll(page);
});

test("sponsorship form posts through FormSubmit", async ({ page }) => {
  let calls = 0;
  let payload = null;
  await page.route("https://formsubmit.co/**", async (route) => {
    calls += 1;
    payload = JSON.parse(route.request().postData() || "{}");
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).toBe("https://formsubmit.co/ajax/executive.wilsonwong@gmail.com");
    expect(route.request().headers()["content-type"]).toContain("application/json");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" })
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sponsorship.html");
  await expect(page.locator("h1")).toHaveText("Sponsorship");
  await expect(page.locator(".section-head .lead")).toHaveText("Looking for sponsorship for speaking, for Cutco, or for your event? Send a submission below and Wilson will get back to you.");
  await expect(page.locator(".cards .card h3")).toHaveText(["Speaking", "Cutco", "Your event"]);
  const desktopCols = await page.locator(".cards").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(desktopCols).toBe(3);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe("rgb(246, 240, 227)");

  const form = page.locator("#sponsorship-form");
  await expect(form).toHaveAttribute("action", "https://formsubmit.co/ajax/executive.wilsonwong@gmail.com");
  await expect(form).toHaveAttribute("method", "POST");
  await expect(form.locator("[name='_honey']")).toHaveCount(1);
  await expect(form.locator("[name='_captcha']")).toHaveValue("false");
  await expect(form.locator("[name='_template']")).toHaveValue("table");
  await expect(form.locator("[name='_subject']")).toHaveValue("New sponsorship submission");
  const names = await form.locator("input, select, textarea").evaluateAll((els) => els.map((el) => el.getAttribute("name")));
  expect(names).toEqual(["_honey", "_captcha", "_template", "_subject", "firstName", "lastName", "phone", "email", "event", "sponsorshipType", "description"]);
  const html = (await page.content()).toLowerCase();
  expect(html).not.toMatch(/credit card|card number|cvv|cvc|payment info|routing number/);

  await form.locator("button[type='submit']").click();
  await expect(page.locator("#sponsor-first")).toHaveAttribute("aria-invalid", "true");
  expect(calls).toBe(0);

  await page.locator("#sponsor-first").fill("Ada");
  await page.locator("#sponsor-last").fill("Lovelace");
  await page.locator("#sponsor-phone").fill("780-555-0100");
  await page.locator("#sponsor-email").fill("ada@example.com");
  await page.locator("#sponsor-event").fill("River Valley talk");
  await page.locator("#sponsor-description").fill("A Saturday speaking slot.");
  await page.locator("#sponsor-type").selectOption("Speaking");
  await page.locator("#sponsor-honey").fill("bot", { force: true });
  await form.locator("button[type='submit']").click();
  await expect(form).toBeVisible();
  expect(calls).toBe(0);

  await page.locator("#sponsor-honey").fill("", { force: true });
  await page.locator("#sponsor-phone").fill("555");
  await form.locator("button[type='submit']").click();
  await expect(page.locator("#sponsor-phone-error")).toHaveText("Add a phone number.");
  expect(calls).toBe(0);

  await page.locator("#sponsor-phone").fill("780-555-0100");
  await page.mouse.move(0, 0);
  await expect.poll(() => form.locator("button[type='submit']").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(47, 107, 79)");
  await form.locator("button[type='submit']").click();
  await expect(page.locator("#sponsorship-thanks")).toBeVisible();
  await expect(page.locator("#sponsorship-thanks")).toHaveText("Thanks. Wilson will get back to you.");
  await expect(form).toBeHidden();
  expect(calls).toBe(1);
  expect(payload._subject).toBe("Website: Sponsorship submission from Ada Lovelace");
  expect(payload._template).toBe("table");
  expect(payload._captcha).toBe(false);
  expect(payload._honey).toBe("");
  expect(payload._replyto).toBe("ada@example.com");
  expect(payload["First name"]).toBe("Ada");
  expect(payload["Last name"]).toBe("Lovelace");
  expect(payload["Phone number"]).toBe("780-555-0100");
  expect(payload.Email).toBe("ada@example.com");
  expect(payload.Event).toBe("River Valley talk");
  expect(payload.Description).toBe("A Saturday speaking slot.");
  expect(payload["Sponsorship type"]).toBe("Speaking");
  expect(payload.Page).toBe("/sponsorship.html");
  expect(payload).not.toHaveProperty("card");
  expect(payload).not.toHaveProperty("payment");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sponsorship.html");
  const mobileCols = await page.locator(".cards").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(mobileCols).toBe(1);
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#nav-links a[href='/sponsorship.html']")).toBeVisible();
  await expect(page.locator("#nav-links a[aria-current='page']")).toHaveText("Sponsorship");
  await noSidewaysScroll(page);
});

test("mobile menu opens on an inner page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/coaching.html");
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#nav-links")).toHaveCSS("transform", "none");
  await expect(page.locator("#nav-links a[href='/speaking.html']")).toBeVisible();
  await shot(page, "menu-390.png");
  await page.locator("#nav-links a[href='/speaking.html']").click();
  await expect(page).toHaveURL(/\/speaking\.html$/);
  await expect(page.locator("h1")).toHaveText("Talks that move people to act");
});

test("placeholder testimonial carousel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/closing-gifts.html");
  const carousel = page.locator("#gift-carousel");
  await expect(carousel.locator(".carousel-slide")).toHaveCount(3);
  await expect(page.locator(".proof-flag")).toContainText("not a real client quote");
  await expect(carousel.locator(".carousel-slide.is-active")).toContainText("Client testimonial coming soon - placeholder");
  await expect(carousel.locator(".carousel-slide.is-active figcaption")).toContainText("Realtor, Edmonton");
  await expect(carousel.locator(".carousel-prev")).toHaveAttribute("aria-label", "Previous testimonial");
  await expect(carousel.locator(".carousel-next")).toHaveAttribute("aria-label", "Next testimonial");

  await carousel.locator(".carousel-next").click();
  await expect(carousel.locator(".carousel-slide.is-active figcaption")).toContainText("Mortgage broker");
  await expect(carousel.locator(".carousel-dot").nth(1)).toHaveAttribute("aria-selected", "true");

  await carousel.locator(".carousel-dot").nth(2).click();
  await expect(carousel.locator(".carousel-slide.is-active figcaption")).toContainText("Financial advisor");

  await carousel.locator(".carousel-next").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(carousel.locator(".carousel-slide.is-active figcaption")).toContainText("Mortgage broker");

  await carousel.locator(".carousel-pause").click();
  await expect(carousel.locator(".carousel-pause")).toHaveAttribute("aria-pressed", "true");
  await expect(carousel.locator(".carousel-pause")).toHaveText("Play");

  const html = await page.content();
  expect(html).toContain("Do not invent quotes");
  expect(html).toContain("Client name");
});

for (const width of [1280, 390]) {
  test("page screenshots at " + width, async ({ page }) => {
    await page.setViewportSize({ width: width, height: width === 390 ? 844 : 900 });
    for (const [href, name] of PAGES) {
      await page.goto(href);
      await expect(page.locator("h1")).toBeVisible();
      await noSidewaysScroll(page);
      await shot(page, name + "-" + width + ".png", true);
    }
    await page.goto("/");
    await page.locator(".doors").scrollIntoViewIfNeeded();
    await page.locator(".doors").screenshot({ path: path.join(ARTIFACTS, "doors-" + width + ".png") });

    await page.goto("/closing-gifts.html");
    await page.locator("#quote-panel").screenshot({ path: path.join(ARTIFACTS, "gifts-cta-" + width + ".png") });
    await page.locator(".proof").screenshot({ path: path.join(ARTIFACTS, "gifts-carousel-" + width + ".png") });
    await page.locator("#quote-final").screenshot({ path: path.join(ARTIFACTS, "gifts-final-" + width + ".png") });
    await noSidewaysScroll(page);
  });
}

test("mobile sticky quote button appears between the two panels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/closing-gifts.html");
  const sticky = page.locator("#gift-sticky");
  await expect(sticky).toHaveClass(/is-hidden/);
  await page.locator(".gifts-grid").scrollIntoViewIfNeeded();
  await expect(sticky).not.toHaveClass(/is-hidden/);
  await expect(sticky.locator("a")).toHaveAttribute("href", "/sharp/");
  await expect(sticky.locator("a")).toHaveAttribute("target", "_blank");
  await shot(page, "gifts-sticky-390.png");
  await page.locator("#quote-final").scrollIntoViewIfNeeded();
  await expect(sticky).toHaveClass(/is-hidden/);
});
