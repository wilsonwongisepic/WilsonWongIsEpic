const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ARTIFACTS = "/opt/cursor/artifacts";

const EVENTS = [
  "page_view",
  "gifting_type_selected",
  "item_added",
  "details_form_opened",
  "pricing_unlocked",
  "quote_sent_to_wilson",
  "call_wilson_clicked"
];

async function noSidewaysScroll(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

async function expectNoPrices(page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\$\s?\d/);
  const catalog = await page.locator("#step-catalog").innerText();
  expect(catalog).not.toMatch(/\$\s?\d/);
  const details = await page.locator("#step-details").innerText();
  expect(details).not.toMatch(/\$\s?\d/);
}

async function shot(page, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACTS, name), fullPage: false });
}

async function runFlow(page, width) {
  const tracked = [];
  let formPayload = null;
  let formType = "";
  await page.route("https://tracking.example/**", async (route) => {
    tracked.push({
      body: JSON.parse(route.request().postData() || "{}"),
      type: route.request().headers()["content-type"] || ""
    });
    await route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://formsubmit.co/**", async (route) => {
    formPayload = JSON.parse(route.request().postData() || "{}");
    formType = route.request().headers()["content-type"] || "";
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).toBe("https://formsubmit.co/ajax/executive.wilsonwong@gmail.com");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" })
    });
  });

  await page.addInitScript(() => {
    window.__TRACKING_ENDPOINT = "https://tracking.example/collect";
  });
  await page.setViewportSize({ width: width, height: width === 390 ? 844 : 900 });
  await page.goto("/sharp/");
  await expect(page.locator("#choose-realtor")).toBeVisible();
  await expectNoPrices(page);
  await noSidewaysScroll(page);
  await shot(page, "quote-" + width + "-1-type.png");

  await page.locator("#choose-realtor").click();
  await expect(page.locator("#catalog-title")).toBeVisible();
  const favourites = page.locator("#feature");
  await expect(favourites).toContainText("Realtor favourites");
  for (const base of ["1822", "3822", "6764", "1502", "3827", "3836", "6721"]) {
    await expect(favourites.locator('.gift-card[data-base="' + base + '"]')).toBeVisible();
  }
  await expectNoPrices(page);

  const pizza = page.locator('.gift-card[data-base="1502"]');
  await pizza.locator(".qty").fill("8");
  await pizza.locator(".add").click();

  const club = page.locator('.gift-card[data-base="1822"]');
  await club.locator('[data-colour="R"]').click();
  await expect(club.locator("[data-deluxe]")).toBeChecked();
  await club.locator(".qty").fill("12");
  await club.locator(".add").click();

  const combo = page.locator('.gift-card[data-base="3836"]');
  await combo.locator('[data-colour="R"]').click();
  await expect(combo.locator("[data-deluxe]")).toBeChecked();
  await combo.locator(".qty").fill("6");
  await combo.locator(".add").click();

  await expect(page.locator("#tray-count")).toContainText("3 items");
  await expectNoPrices(page);
  await noSidewaysScroll(page);
  await shot(page, "quote-" + width + "-2-catalog.png");

  await page.locator("#continue-details").click();
  await expect(page.locator("#step-details")).toBeVisible();
  await expect(page.locator("#see-quote")).toBeDisabled();
  await page.locator("#see-quote").evaluate((button) => {
    button.disabled = false;
    button.form.requestSubmit();
  });
  await expect(page.locator("#step-quote")).toBeHidden();
  await expect(page.locator("#form-summary")).toContainText("first name");

  await page.locator("#firstName").fill("Avery");
  await page.locator("#lastName").fill("Chen");
  await page.locator("#business").fill("Northline Realty");
  await page.locator("#phone").fill("12345");
  await page.locator("#email").fill("not-an-email");
  await page.locator("#province").selectOption("ON");
  await expect(page.locator("#see-quote")).toBeDisabled();
  await expect(page.locator("#step-quote")).toBeHidden();

  await page.locator("#phone").fill("7805550148");
  await page.locator("#email").fill("avery.chen@example.com");
  await page.locator("#engraving").selectOption("Logo");
  await page.locator("#engravingNotes").fill("Northline wordmark");
  await page.locator("#occasion").fill("Closings");
  await page.locator("#volume").fill("40 gifts over the next 6 months");
  await expect(page.locator("#see-quote")).toBeEnabled();
  await expectNoPrices(page);
  await noSidewaysScroll(page);
  await shot(page, "quote-" + width + "-3-details.png");

  await page.locator("#see-quote").click();
  await expect(page.locator("#step-quote")).toBeVisible();
  await expect(page.locator("#quote-number")).toHaveText(/WW-\d{8}-[A-HJ-NP-Z2-9]{4}/);
  const quoteNumber = (await page.locator("#quote-number").innerText()).trim();

  await expect(page.locator('[data-sku="1502C"] .unit')).toHaveText("$93.00");
  await expect(page.locator('[data-sku="1502C"] .ext')).toHaveText("$744.00");
  await expect(page.locator('[data-sku="1822RD"] .unit')).toHaveText("$230.00");
  await expect(page.locator('[data-sku="1822RD"] .ext')).toHaveText("$2,760.00");
  await expect(page.locator('[data-sku="3836RD"] .unit')).toHaveText("$310.00");
  await expect(page.locator('[data-sku="3836RD"] .ext')).toHaveText("$1,860.00");
  await expect(page.locator("#subtotal")).toHaveText("$5,364.00");
  await expect(page.locator("#shipping")).toHaveText("$75.00");

  async function expectTax(province, rows, total) {
    await page.locator("#quote-province").selectOption(province);
    for (const [name, text] of rows) {
      await expect(page.locator('[data-tax="' + name + '"]')).toHaveText(text);
    }
    await expect(page.locator("#total")).toHaveText(total);
  }

  await expectTax("ON", [["HST", "HST (13%) $707.07"]], "$6,146.07");
  await expect(page.locator("#shipping-note")).toBeHidden();
  await expect(page.locator('[data-tax="PST"]')).toHaveCount(0);
  await expectTax("BC", [
    ["GST", "GST (5%) $271.95"],
    ["PST", "PST (7%) $380.73"]
  ], "$6,091.68");
  await expectTax("QC", [
    ["GST", "GST (5%) $271.95"],
    ["QST", "QST (9.975%) $542.54"]
  ], "$6,253.49");
  await expectTax("AB", [["GST", "GST (5%) $271.95"]], "$5,710.95");
  await expect(page.locator('[data-tax="HST"]')).toHaveCount(0);
  await expect(page.locator('[data-tax="PST"]')).toHaveCount(0);
  await noSidewaysScroll(page);
  await shot(page, "quote-" + width + "-4-quote.png");

  await page.locator("#quote-province").selectOption("ON");
  const clubQty = page.locator('[data-sku="1822RD"] .line-qty');
  await clubQty.fill("100");
  await clubQty.blur();
  await expect(page.locator('[data-sku="1822RD"] .unit')).toHaveText("$210.00");
  await expect(page.locator('[data-sku="1822RD"] .ext')).toHaveText("$21,000.00");
  await expect(page.locator("#subtotal")).toHaveText("$23,604.00");
  await expect(page.locator("#shipping")).toHaveText("Pending, Wilson will confirm");
  await expect(page.locator("#shipping-note")).toBeVisible();
  await expect(page.locator("#shipping-note")).toContainText("not included in the total");
  await expect(page.locator('[data-tax="HST"]')).toHaveText("HST (13%) $3,068.52");
  await expect(page.locator("#total")).toHaveText("$26,672.52");
  await noSidewaysScroll(page);
  await shot(page, "quote-" + width + "-5-shipping-pending.png");

  await expect(page.locator("#call-wilson")).toHaveAttribute("href", "tel:0000000000");
  await page.locator("#send-quote").click();
  await expect(page.locator("#confirmation")).toContainText("Wilson has your quote " + quoteNumber);
  await expect(page.locator("#confirmation")).toContainText("Nothing is charged");
  await shot(page, "quote-" + width + "-6-sent.png");

  expect(formPayload).toBeTruthy();
  expect(formType).toContain("application/json");
  expect(formPayload._subject).toBe("New gift quote " + quoteNumber);
  expect(formPayload._template).toBe("table");
  expect(formPayload._captcha).toBe(false);
  expect(formPayload["Quote number"]).toBe(quoteNumber);
  expect(formPayload["First name"]).toBe("Avery");
  expect(formPayload["Last name"]).toBe("Chen");
  expect(formPayload["Business"]).toBe("Northline Realty");
  expect(formPayload["Phone"].replace(/\D/g, "")).toBe("7805550148");
  expect(formPayload["Email"]).toBe("avery.chen@example.com");
  expect(formPayload["Province"]).toBe("ON");
  expect(formPayload["Gifting type"]).toBe("Realtor");
  expect(formPayload["Engraving"]).toBe("Logo");
  expect(formPayload["Engraving notes"]).toBe("Northline wordmark");
  expect(formPayload["Occasion"]).toBe("Closings");
  expect(formPayload["Estimated volume"]).toBe("40 gifts over the next 6 months");
  expect(formPayload["Items"]).toContain("1502C");
  expect(formPayload["Items"]).toContain("1822RD");
  expect(formPayload["Items"]).toContain("3836RD");
  expect(formPayload["Items"]).toContain("qty 100");
  expect(formPayload["Items"]).toContain("qty 8");
  expect(formPayload["Items"]).toContain("qty 6");
  expect(formPayload["Items"]).toContain("$210.00");
  expect(formPayload["Subtotal (CAD)"]).toBe("23604.00");
  expect(formPayload["Shipping (CAD)"]).toBe("Pending, Wilson will confirm");
  expect(formPayload["Tax (CAD)"]).toContain("HST (13%) $3,068.52");
  expect(formPayload["Total (CAD)"]).toBe("26672.52");
  expect(JSON.stringify(formPayload).toLowerCase()).not.toContain("card number");

  await page.locator("#call-wilson").click();

  const bodies = tracked.map((entry) => entry.body);
  const names = bodies.map((body) => body.event).filter(Boolean);
  for (const name of EVENTS) expect(names).toContain(name);
  expect(names.filter((name) => name === "item_added").length).toBeGreaterThanOrEqual(3);
  expect(tracked.every((entry) => entry.type.includes("text/plain"))).toBe(true);
  const selected = bodies.find((body) => body.event === "gifting_type_selected");
  expect(selected.giftingType).toBe("Realtor");
  const unlocked = bodies.find((body) => body.event === "pricing_unlocked");
  expect(unlocked.quoteNumber).toBe(quoteNumber);
  expect(unlocked.province).toBe("ON");
  expect(unlocked.giftingType).toBe("Realtor");
  const sent = bodies.find((body) => body.event === "quote_sent_to_wilson");
  expect(sent.giftingType).toBe("Realtor");
  expect(sent.totalQuantity).toBe(114);
  const lead = bodies.find((body) => body.type === "lead");
  expect(lead.quoteNumber).toBe(quoteNumber);
  expect(lead.firstName).toBe("Avery");
  expect(lead.lastName).toBe("Chen");
  expect(lead.business).toBe("Northline Realty");
  expect(String(lead.phone).replace(/\D/g, "")).toBe("7805550148");
  expect(lead.email).toBe("avery.chen@example.com");
  expect(lead.province).toBe("ON");
  expect(lead.giftingType).toBe("Realtor");
  expect(lead.items).toContain("1822RD");
  expect(lead.totalQuantity).toBe(114);
  expect(lead.subtotal).toBe("23604.00");
  expect(lead.shipping).toBe("Pending, Wilson will confirm");
  expect(lead.tax).toBe("3068.52");
  expect(lead.total).toBe("26672.52");
  expect(bodies.find((body) => body.event === "page_view").giftingType).toBe("");
}

test("home page opens the quote builder in a new tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const link = page.locator('a[href="/sharp/"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener");
  await expect(link).toContainText("Build your gift quote");
  await noSidewaysScroll(page);
  await shot(page, "home-gift-cta-390.png");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const gifts = page.locator("#gifts");
  await gifts.scrollIntoViewIfNeeded();
  await expect(gifts.locator('a[href="/sharp/"]')).toBeVisible();
  await noSidewaysScroll(page);
  await gifts.screenshot({ path: "/opt/cursor/artifacts/home-gift-cta-1280.png" });
});

for (const width of [1280, 390]) {
  test("quote flow at " + width, async ({ page }) => {
    await runFlow(page, width);
  });
}
