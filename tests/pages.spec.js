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
    "/contact.html"
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
    "/contact.html": "Book Wilson"
  };
  for (const [href, label] of Object.entries(current)) {
    await page.goto(href);
    await expect(page.locator("nav a[aria-current='page']")).toHaveText(label);
    await expect(page.locator("title")).not.toHaveText("Wilson Wong — Speaker & Sales Coach");
    await noSidewaysScroll(page);
  }
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
