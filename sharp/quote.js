/* ============================================================
   Wilson: settings live in this file.

   WILSON_PHONE
   Shown on the call button. The tel: link is +1 plus these digits.

   WILSON_EMAIL
   Shown next to the call button and used for the quote email.

   TRACKING_ENDPOINT
   Leave this as "" until the Google Sheet web app is deployed.
   Then paste that URL between the quotes.
   While it is empty, the page does not send tracking.
   ============================================================ */
const WILSON_PHONE = "780-915-0982";
const WILSON_EMAIL = "executive.wilsonwong@gmail.com";
const TRACKING_ENDPOINT = "";
const ORDER_MIN = (window.CUTCO_CATALOG && window.CUTCO_CATALOG.orderMin) || 6;

const EVENTS = {
  pageView: "page_view",
  typeSelected: "gifting_type_selected",
  itemAdded: "item_added",
  detailsOpened: "details_form_opened",
  pricingUnlocked: "pricing_unlocked",
  quoteSent: "quote_sent_to_wilson",
  callClicked: "call_wilson_clicked"
};

const REALTOR_ORDER = ["1822", "3822", "6764", "1502", "3827", "3836", "6721"];
const BUSINESS_ORDER = ["6166", "6766"];
const COLLECTION_ORDER = [
  "Introduction", "Appreciation", "Recognition", "Outdoor", "Luxury",
  "Individual Items", "Table & Steak Knives", "Gift Sets", "Block Sets", "Garden Sets"
];
const PROVINCES = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon"
};
const TAX = {
  AB: [{ name: "GST", rate: 5 }],
  NT: [{ name: "GST", rate: 5 }],
  NU: [{ name: "GST", rate: 5 }],
  YT: [{ name: "GST", rate: 5 }],
  BC: [{ name: "GST", rate: 5 }, { name: "PST", rate: 7 }],
  SK: [{ name: "GST", rate: 5 }, { name: "PST", rate: 6 }],
  MB: [{ name: "GST", rate: 5 }, { name: "PST", rate: 8 }],
  QC: [{ name: "GST", rate: 5 }, { name: "QST", rate: 9.975 }],
  ON: [{ name: "HST", rate: 13 }],
  NB: [{ name: "HST", rate: 15 }],
  NL: [{ name: "HST", rate: 15 }],
  NS: [{ name: "HST", rate: 15 }],
  PE: [{ name: "HST", rate: 15 }]
};

const CATALOG = (window.CUTCO_CATALOG && window.CUTCO_CATALOG.items) || [];
const byBase = new Map(CATALOG.map((item) => [item.base, item]));

const state = {
  giftingType: "",
  lines: [],
  search: "",
  collection: "All",
  unlocked: false,
  quoteNumber: "",
  sent: false,
  contact: emptyContact()
};
let unlockTracked = false;

function emptyContact() {
  return {
    firstName: "", lastName: "", business: "", phone: "", email: "", province: "",
    engraving: "", engravingNotes: "", occasion: "", volume: ""
  };
}

function itemOf(base) { return byBase.get(base); }

function tierFor(qty) {
  const tiers = [1000, 500, 250, 100, 50, 25, 10];
  for (const tier of tiers) if (qty >= tier) return tier;
  return 10;
}

function skuOf(item, line) {
  const letter = ["C", "W", "R"].includes(line.colourId) ? line.colourId : "";
  const box = item.giftBox === "deluxe" && line.deluxe ? "D" : "";
  return item.base + letter + box;
}

function colourOf(item, id) {
  return item.colours.find((colour) => colour.id === id) || item.colours[0];
}

function lineId(base, colourId, deluxe) {
  return base + "|" + colourId + "|" + (deluxe ? "D" : "N");
}

function formatCAD(cents) {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-$" : "$") + grouped + "." + rem;
}

function moneyNumber(cents) {
  return (Math.round(cents) / 100).toFixed(2);
}

function taxCents(baseCents, rate) {
  if (rate === 9.975) return Math.round(baseCents * 9975 / 100000);
  return Math.round(baseCents * rate / 100);
}

function rateLabel(rate) {
  return (rate === 9.975 ? "9.975" : String(rate)) + "%";
}

function describe(item, line) {
  const parts = [item.name];
  const colour = colourOf(item, line.colourId);
  if (colour) parts.push(colour.label);
  if (item.giftBox === "deluxe" && line.deluxe) parts.push("deluxe gift box");
  else if (item.giftBox === "fixed" && item.giftBoxNote) parts.push(item.giftBoxNote.replace(/\.$/, ""));
  return parts.join(", ");
}

function buildQuote() {
  const lines = state.lines.map((line) => {
    const item = itemOf(line.base);
    const tier = tierFor(line.qty);
    const unitCents = Math.round(item.prices[String(tier)] * 100);
    return {
      id: line.id,
      base: line.base,
      colourId: line.colourId,
      deluxe: line.deluxe,
      sku: skuOf(item, line),
      description: describe(item, line),
      qty: line.qty,
      tier: tier,
      unitCents: unitCents,
      lineCents: unitCents * line.qty,
      shippingIncluded: item.shippingIncluded,
      sheathPrice: item.sheathPrice,
      customerNote: item.customerNote || ""
    };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const shippingPending = subtotalCents > 1000000;
  const shippingCents = shippingPending ? 0 : 7500;
  const taxBase = subtotalCents + shippingCents;
  const rules = TAX[state.contact.province] || [];
  const taxes = rules.map((rule) => ({
    name: rule.name,
    rate: rule.rate,
    cents: taxCents(taxBase, rule.rate)
  }));
  const taxTotal = taxes.reduce((sum, tax) => sum + tax.cents, 0);
  return {
    lines: lines,
    subtotalCents: subtotalCents,
    shippingPending: shippingPending,
    shippingCents: shippingCents,
    taxes: taxes,
    taxCents: taxTotal,
    totalCents: taxBase + taxTotal,
    totalQuantity: lines.reduce((sum, line) => sum + line.qty, 0)
  };
}

function itemsSelected() {
  return buildQuote().lines.map((line) => line.sku + " x" + line.qty).join(", ");
}

function readableItems(quote) {
  return quote.lines.map((line) => {
    return line.sku + " — " + line.description + " — qty " + line.qty +
      " — unit " + formatCAD(line.unitCents) + " — line " + formatCAD(line.lineCents);
  }).join(" || ");
}

function taxSummary(quote) {
  if (!quote.taxes.length) return moneyNumber(quote.taxCents);
  return quote.taxes.map((tax) => tax.name + " (" + rateLabel(tax.rate) + ") " + formatCAD(tax.cents)).join("; ");
}

function phoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return "";
  if (digits[0] === "0" || digits[0] === "1") return "";
  if (digits[3] === "0" || digits[3] === "1") return "";
  return digits;
}

function formatPhone(digits) {
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function wilsonTel() {
  let digits = String(WILSON_PHONE || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits;
  return "tel:+" + digits;
}

function orderPieces() {
  return state.lines.reduce((sum, line) => sum + (parseInt(line.qty, 10) || 0), 0);
}

function endpoint() {
  if (typeof window.__TRACKING_ENDPOINT === "string") return window.__TRACKING_ENDPOINT;
  return TRACKING_ENDPOINT;
}

function sessionId() {
  const key = "ww-sharp-session";
  let id = "";
  try { id = sessionStorage.getItem(key) || ""; } catch (err) { id = ""; }
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem(key, id); } catch (err) { /* private mode */ }
  }
  return id;
}

function deviceLabel() {
  return window.matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop";
}

function postTracking(body) {
  const url = endpoint();
  if (!url) return;
  fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body)
  }).catch(function () {});
}

function track(event) {
  const quote = buildQuote();
  postTracking({
    timestamp: new Date().toISOString(),
    event: event,
    sessionId: sessionId(),
    quoteNumber: state.quoteNumber || "",
    giftingType: state.giftingType || "",
    itemsSelected: itemsSelected(),
    totalQuantity: quote.totalQuantity,
    estSubtotal: Number(moneyNumber(quote.subtotalCents)),
    province: state.contact.province || "",
    page: location.pathname,
    referrer: document.referrer || "",
    device: deviceLabel()
  });
}

function trackLead(quote) {
  postTracking({
    type: "lead",
    quoteNumber: state.quoteNumber,
    firstName: state.contact.firstName,
    lastName: state.contact.lastName,
    business: state.contact.business,
    phone: state.contact.phone,
    email: state.contact.email,
    province: state.contact.province,
    giftingType: state.giftingType,
    items: readableItems(quote),
    totalQuantity: quote.totalQuantity,
    subtotal: moneyNumber(quote.subtotalCents),
    shipping: quote.shippingPending ? "Pending, Wilson will confirm" : moneyNumber(quote.shippingCents),
    tax: moneyNumber(quote.taxCents),
    total: moneyNumber(quote.totalCents)
  });
}

function el(tag, attrs) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((key) => {
      const value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value === true ? "" : value);
    });
  }
  return node;
}

function show(which) {
  ["type", "catalog", "details", "quote"].forEach((name) => {
    document.getElementById("step-" + name).hidden = name !== which;
  });
  document.body.classList.toggle("browsing", which === "catalog");
  window.scrollTo(0, 0);
}

function defaultColour(item) {
  if (state.giftingType === "Business" && item.businessFeature && item.colours.some((c) => c.id === "W")) return "W";
  if (item.colours.some((c) => c.id === "C")) return "C";
  return item.colours[0].id;
}

function featureItems() {
  const order = state.giftingType === "Realtor" ? REALTOR_ORDER : state.giftingType === "Business" ? BUSINESS_ORDER : [];
  return order.map((base) => itemOf(base)).filter(Boolean);
}

function gridItems() {
  const query = state.search.trim().toLowerCase();
  let items = CATALOG.slice();
  if (!query && state.collection === "All") {
    const hidden = new Set(featureItems().map((item) => item.base));
    items = items.filter((item) => !hidden.has(item.base));
  }
  if (state.collection !== "All") items = items.filter((item) => item.collection === state.collection);
  if (query) {
    items = items.filter((item) => (item.name + " " + item.base).toLowerCase().includes(query));
  }
  return items;
}

function publicNote(item) {
  return String(item.customerNote || "").split(". ").filter((part) => part && !part.includes("$")).join(". ");
}

function renderFeature() {
  const mount = document.getElementById("feature");
  mount.replaceChildren();
  if (state.search.trim() || state.collection !== "All") return;
  const items = featureItems();
  if (!items.length) return;
  const band = el("div", { class: "banner" });
  const title = el("h2");
  const copy = el("p", { class: "lead" });
  if (state.giftingType === "Realtor") {
    title.textContent = "Realtor favourites";
    copy.textContent = "Club Mates, the traditional cheese knife, the pizza cutter, the Time Saver, the petite Santoku combo, and the Santoku-style trimmer. A solid set to reorder through the year.";
  } else {
    title.textContent = "Pearl white Santoku, ready for a logo";
    copy.textContent = "The 5 inch petite Santoku and the 7 inch Santoku in pearl white, with the deluxe gift box. Engraving is confirmed with Wilson after the quote.";
  }
  band.append(title, copy);
  const grid = el("div", { class: "feature-grid" });
  items.forEach((item) => grid.append(cardFor(item, true)));
  band.append(grid);
  mount.append(band);
}

function renderChips() {
  const mount = document.getElementById("collections");
  mount.replaceChildren();
  const names = ["All"].concat(COLLECTION_ORDER.filter((name) => CATALOG.some((item) => item.collection === name)));
  names.forEach((name) => {
    const button = el("button", { type: "button", class: "chip", "aria-pressed": name === state.collection ? "true" : "false" });
    button.textContent = name;
    button.addEventListener("click", () => {
      state.collection = name;
      renderCatalog();
    });
    mount.append(button);
  });
}

function renderPicks() {
  const mount = document.getElementById("picks");
  mount.replaceChildren();
  if (!state.lines.length) return;
  const heading = el("h3");
  heading.textContent = "In this quote";
  mount.append(heading);
  state.lines.forEach((line) => {
    const item = itemOf(line.base);
    const row = el("div", { class: "pick" });
    const text = el("div");
    const name = el("strong");
    name.textContent = skuOf(item, line) + " · " + item.name;
    const meta = el("p", { class: "meta" });
    meta.textContent = "Qty " + line.qty;
    text.append(name, meta);
    const remove = el("button", { type: "button", class: "linkish" });
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.lines = state.lines.filter((entry) => entry.id !== line.id);
      renderCatalog();
    });
    row.append(text, remove);
    mount.append(row);
  });
}

function renderTray() {
  const count = document.getElementById("tray-count");
  const sub = document.getElementById("tray-sub");
  const pieces = orderPieces();
  if (!pieces) {
    count.textContent = "No gifts yet";
    sub.textContent = "6 gifts minimum for the order. Mix any items.";
  } else if (pieces < ORDER_MIN) {
    count.textContent = pieces + " of 6 minimum";
    sub.textContent = "Add " + (ORDER_MIN - pieces) + " more. You can mix any gifts.";
  } else {
    count.textContent = pieces + (pieces === 1 ? " gift" : " gifts");
    sub.textContent = "Minimum of 6 reached.";
  }
  document.getElementById("continue-details").disabled = pieces === 0;
}

function cardFor(item, featured) {
  const card = el("article", { class: "card gift-card", "data-base": item.base });
  const existing = state.lines.find((line) => line.base === item.base);
  let colourId = existing ? existing.colourId : defaultColour(item);
  let deluxe = existing ? existing.deluxe : item.giftBox === "deluxe";
  let qty = existing ? existing.qty : 1;

  const photo = el("div", { class: "photo" });
  const img = el("img", { alt: item.name, width: "800", height: "800" });
  img.loading = featured ? "eager" : "lazy";
  const setPhoto = () => {
    const file = (item.images && (item.images[colourId] || Object.values(item.images)[0])) || "placeholder.webp";
    img.src = "images/" + file;
  };
  img.addEventListener("error", () => { img.src = "images/placeholder.webp"; });
  setPhoto();
  photo.append(img);

  const body = el("div", { class: "body" });
  if (featured && state.giftingType === "Realtor") {
    const badge = el("span", { class: "badge" });
    badge.textContent = "Realtor favourite";
    body.append(badge);
  }
  if (featured && state.giftingType === "Business") {
    const badge = el("span", { class: "badge" });
    badge.textContent = "Logo engraving";
    body.append(badge);
  }
  const title = el("h3");
  title.textContent = item.name;
  const meta = el("p", { class: "meta" });
  meta.textContent = item.collection + " · #" + item.base;
  body.append(title, meta);

  const note = publicNote(item);
  if (note) {
    const p = el("p", { class: "meta" });
    p.textContent = note;
    body.append(p);
  }

  const sku = el("p", { class: "sku-preview" });
  const swatches = el("div", { class: "swatches" });
  const colourName = el("span", { class: "meta" });
  if (item.colours.length > 1) {
    item.colours.forEach((colour) => {
      const button = el("button", {
        type: "button",
        class: "swatch swatch-" + colour.id,
        "aria-label": colour.label,
        "aria-pressed": colour.id === colourId ? "true" : "false",
        "data-colour": colour.id
      });
      button.addEventListener("click", () => {
        colourId = colour.id;
        swatches.querySelectorAll(".swatch").forEach((swatch) => {
          swatch.setAttribute("aria-pressed", swatch.getAttribute("data-colour") === colourId ? "true" : "false");
        });
        refreshCard();
      });
      swatches.append(button);
    });
    body.append(swatches, colourName);
  } else {
    colourName.textContent = "Colour: " + item.colours[0].label;
    body.append(colourName);
  }

  let boxInput = null;
  if (item.giftBox === "deluxe") {
    const label = el("label", { class: "check" });
    boxInput = el("input", { type: "checkbox", "data-deluxe": "true" });
    boxInput.checked = deluxe;
    const span = el("span");
    span.textContent = "Deluxe gift box";
    label.append(boxInput, span);
    boxInput.addEventListener("change", () => { deluxe = boxInput.checked; refreshCard(); });
    body.append(label);
  } else if (item.giftBoxNote) {
    const p = el("p", { class: "meta" });
    p.textContent = item.giftBoxNote;
    body.append(p);
  }

  const qtyRow = el("div", { class: "qty-row" });
  const dec = el("button", { type: "button", "aria-label": "Decrease quantity" });
  dec.textContent = "−";
  const input = el("input", { class: "qty", inputmode: "numeric", min: "1", "aria-label": "Quantity for " + item.name });
  input.value = String(qty);
  const inc = el("button", { type: "button", "aria-label": "Increase quantity" });
  inc.textContent = "+";
  const setQty = (next) => {
    qty = Math.min(9999, Math.max(1, next));
    input.value = String(qty);
  };
  dec.addEventListener("click", () => setQty(qty - 1));
  inc.addEventListener("click", () => setQty(qty + 1));
  input.addEventListener("input", () => {
    const next = parseInt(input.value, 10);
    if (next >= 1 && next <= 9999) qty = next;
  });
  input.addEventListener("change", () => {
    const next = parseInt(input.value, 10);
    if (next >= 1 && next <= 9999) setQty(next);
    else input.value = String(qty);
  });
  qtyRow.append(dec, input, inc);
  const hint = el("p", { class: "hint" });
  hint.textContent = "Each item can be 1 or more. The order needs 6 gifts in total.";
  const error = el("p", { class: "card-error" });
  const add = el("button", { type: "button", class: "btn btn-primary small add" });
  add.textContent = existing ? "Update quote" : "Add to quote";
  add.addEventListener("click", () => {
    const next = parseInt(input.value, 10);
    if (!(next >= 1)) {
      error.textContent = "Enter at least 1 of this item.";
      return;
    }
    error.textContent = "";
    qty = next;
    const id = lineId(item.base, colourId, item.giftBox === "deluxe" && deluxe);
    const prior = state.lines.find((line) => line.id === id);
    const grew = !prior || next > prior.qty;
    const without = state.lines.filter((line) => line.id !== id);
    without.push({ id: id, base: item.base, colourId: colourId, deluxe: item.giftBox === "deluxe" && deluxe, qty: qty });
    state.lines = without;
    if (grew) track(EVENTS.itemAdded);
    renderCatalog();
  });

  function refreshCard() {
    const draft = { colourId: colourId, deluxe: item.giftBox === "deluxe" && deluxe };
    sku.textContent = "Item " + skuOf(item, draft);
    const colour = colourOf(item, colourId);
    if (item.colours.length > 1) colourName.textContent = colour ? colour.label : "";
    setPhoto();
  }
  refreshCard();
  body.append(sku, qtyRow, hint, error, add);
  card.append(photo, body);
  return card;
}

function renderGrid() {
  const mount = document.getElementById("grid");
  mount.replaceChildren();
  const items = gridItems();
  if (!items.length) {
    const p = el("p", { class: "empty" });
    p.textContent = "Nothing matches that search. Try a product name or an item number.";
    mount.append(p);
    return;
  }
  items.forEach((item) => mount.append(cardFor(item, false)));
}

function renderCatalog() {
  const kicker = document.getElementById("catalog-kicker");
  kicker.textContent = state.giftingType === "Realtor" ? "Realtor" : "Business gifting";
  renderFeature();
  renderChips();
  renderPicks();
  renderGrid();
  renderTray();
}

function fieldError(id, message) {
  const input = document.getElementById(id);
  const slot = document.getElementById("err-" + id);
  if (slot) slot.textContent = message || "";
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function readContactFromForm() {
  const contact = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    business: document.getElementById("business").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    province: document.getElementById("province").value,
    engraving: document.getElementById("engraving").value,
    engravingNotes: document.getElementById("engravingNotes").value.trim(),
    occasion: document.getElementById("occasion").value.trim(),
    volume: document.getElementById("volume").value.trim()
  };
  return contact;
}

function contactErrors(contact) {
  const errors = {};
  if (!contact.firstName) errors.firstName = "Enter a first name.";
  if (!contact.lastName) errors.lastName = "Enter a last name.";
  if (!contact.business) errors.business = "Enter a business name.";
  if (!phoneDigits(contact.phone)) errors.phone = "Enter a 10-digit Canadian phone number.";
  if (!validEmail(contact.email)) errors.email = "Enter a valid email address.";
  if (!PROVINCES[contact.province]) errors.province = "Choose a Canadian province or territory.";
  return errors;
}

function refreshFormButton() {
  const contact = readContactFromForm();
  const errors = contactErrors(contact);
  const pieces = orderPieces();
  const short = pieces < ORDER_MIN;
  const orderNote = document.getElementById("order-minimum");
  if (orderNote) {
    orderNote.textContent = short
      ? pieces + " of 6 minimum. Add " + (ORDER_MIN - pieces) + " more gifts to see pricing. You can mix any items."
      : pieces + " gifts. The minimum of 6 is met.";
  }
  document.getElementById("see-quote").disabled = short || Object.keys(errors).length > 0;
}

function showDetails() {
  ["firstName", "lastName", "business", "phone", "email", "province", "engraving", "engravingNotes", "occasion", "volume"].forEach((id) => {
    const node = document.getElementById(id);
    if (node && state.contact[id] != null) node.value = state.contact[id];
  });
  refreshFormButton();
  show("details");
  track(EVENTS.detailsOpened);
}

function showCatalog() {
  show("catalog");
  renderCatalog();
}

function quoteNumberNew() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let suffix = "";
  bytes.forEach((byte) => { suffix += alphabet[byte % alphabet.length]; });
  return "WW-" + y + m + d + "-" + suffix;
}

function fillFigures(quote) {
  document.getElementById("subtotal").textContent = formatCAD(quote.subtotalCents);
  const shipping = document.getElementById("shipping");
  const note = document.getElementById("shipping-note");
  if (quote.shippingPending) {
    shipping.textContent = "Pending, Wilson will confirm";
    shipping.dataset.shipping = "pending";
    note.hidden = false;
  } else {
    shipping.textContent = formatCAD(quote.shippingCents);
    delete shipping.dataset.shipping;
    note.hidden = true;
  }
  const taxes = document.getElementById("tax-lines");
  taxes.replaceChildren();
  quote.taxes.forEach((tax) => {
    const row = el("p", { "data-tax": tax.name });
    const label = el("span");
    label.textContent = tax.name + " (" + rateLabel(tax.rate) + ") ";
    const amount = el("span");
    amount.textContent = formatCAD(tax.cents);
    row.append(label, amount);
    taxes.append(row);
  });
  document.getElementById("total").textContent = formatCAD(quote.totalCents);
  quote.lines.forEach((line) => {
    const row = document.querySelector('.quote-line[data-sku="' + line.sku + '"]');
    if (!row) return;
    row.querySelector(".unit").textContent = formatCAD(line.unitCents);
    row.querySelector(".ext").textContent = formatCAD(line.lineCents);
    const input = row.querySelector(".line-qty");
    if (input && document.activeElement !== input) input.value = String(line.qty);
  });
}

function renderQuote() {
  const quote = buildQuote();
  const mount = document.getElementById("quote-mount");
  mount.replaceChildren();

  const top = el("div", { class: "quote-top" });
  const headingWrap = el("div");
  const eyebrow = el("span", { class: "eyebrow" });
  eyebrow.textContent = "Quote · " + (state.giftingType === "Realtor" ? "Realtor" : "Business gifting");
  const title = el("h2");
  title.textContent = "Your gift quote";
  const number = el("p", { class: "quote-no", id: "quote-number" });
  number.textContent = state.quoteNumber;
  headingWrap.append(eyebrow, title, number);
  const who = el("p", { class: "meta", id: "quote-for" });
  who.textContent = state.contact.firstName + " " + state.contact.lastName + " · " + state.contact.business + " · " + (PROVINCES[state.contact.province] || "");
  top.append(headingWrap, who);

  const lines = el("div", { class: "quote-lines" });
  quote.lines.forEach((line) => {
    const row = el("article", { class: "quote-line", "data-sku": line.sku });
    const head = el("div", { class: "top" });
    const idBlock = el("div");
    const sku = el("div", { class: "sku" });
    sku.textContent = line.sku;
    const desc = el("div");
    desc.textContent = line.description;
    idBlock.append(sku, desc);
    const qtyWrap = el("label", { class: "qty-row" });
    const qty = el("input", { class: "line-qty", inputmode: "numeric", min: "1", "aria-label": "Quantity for " + line.sku });
    qty.value = String(line.qty);
    const commitQty = () => {
      const stored = state.lines.find((entry) => entry.id === line.id);
      if (!stored) return;
      const next = parseInt(qty.value, 10);
      if (!(next >= 1 && next <= 9999)) {
        qty.value = String(stored.qty);
        return;
      }
      stored.qty = next;
      fillFigures(buildQuote());
    };
    qty.addEventListener("input", commitQty);
    qty.addEventListener("change", commitQty);
    qtyWrap.append(qty);
    head.append(idBlock, qtyWrap);
    const money = el("div", { class: "money-row" });
    const unit = el("span");
    unit.append(document.createTextNode("Unit "), el("span", { class: "unit" }));
    const ext = el("span");
    ext.append(document.createTextNode("Line "), el("span", { class: "ext" }));
    money.append(unit, ext);
    row.append(head, money);
    const extra = [];
    if (line.customerNote) extra.push(line.customerNote);
    if (!line.shippingIncluded) extra.push("This set's list price does not include shipping.");
    if (line.sheathPrice) extra.push("Optional sheath +" + formatCAD(line.sheathPrice * 100) + " is not included.");
    if (extra.length) {
      const note = el("p", { class: "meta" });
      note.textContent = extra.join(" ");
      row.append(note);
    }
    lines.append(row);
  });

  const totals = el("div", { class: "totals" });
  const provinceField = el("label", { class: "field" });
  const provinceLabel = el("span");
  provinceLabel.textContent = "Province or territory";
  const province = el("select", { id: "quote-province" });
  Object.keys(PROVINCES).forEach((code) => {
    const option = el("option", { value: code });
    option.textContent = PROVINCES[code];
    if (code === state.contact.province) option.selected = true;
    province.append(option);
  });
  province.addEventListener("change", () => {
    state.contact.province = province.value;
    const formProvince = document.getElementById("province");
    if (formProvince) formProvince.value = province.value;
    fillFigures(buildQuote());
  });
  provinceField.append(provinceLabel, province);

  const sub = el("p");
  const subLabel = el("span");
  subLabel.textContent = "Subtotal";
  const subAmount = el("span", { id: "subtotal" });
  sub.append(subLabel, subAmount);
  const ship = el("p");
  const shipLabel = el("span");
  shipLabel.textContent = "Shipping";
  const shipAmount = el("span", { id: "shipping" });
  ship.append(shipLabel, shipAmount);
  const shipNote = el("p", { class: "meta", id: "shipping-note" });
  shipNote.textContent = "Shipping is pending. Wilson will confirm the cost. It is not included in the total. Tax shown does not include tax on that shipping.";
  const taxLines = el("div", { id: "tax-lines" });
  const grand = el("p", { class: "grand" });
  const grandLabel = el("span");
  grandLabel.textContent = "Total";
  const grandAmount = el("span", { id: "total" });
  grand.append(grandLabel, grandAmount);
  totals.append(provinceField, sub, ship, shipNote, taxLines, grand);

  const notes = el("ul", { class: "notes" });
  [
    "A new logo has a one-time $65 set-up fee. Wilson may waive it.",
    "Engraved orders add 10 to 14 business days.",
    "Prices are estimates from the Canada Volume Specials sheet (valid through 1/27). Wilson confirms the final quote.",
    "You pay in full. This page never collects card or payment details.",
    "The minimum of 6 is for the whole order, so items can be mixed. Any quantity under 10 uses the 10+ price. Higher quantities use the matching volume column."
  ].forEach((text) => {
    const li = el("li");
    li.textContent = text;
    notes.append(li);
  });
  if (quote.lines.some((line) => !line.shippingIncluded)) {
    const li = el("li");
    li.textContent = "Block and luxury sets are priced without shipping. The shipping line is still an estimate until Wilson confirms it.";
    notes.append(li);
  }

  const callout = el("div", { class: "callout" });
  const callTitle = el("h2");
  callTitle.textContent = "Call Wilson for deals and promotions";
  const callCopy = el("p");
  callCopy.textContent = "Volume specials and current promotions are confirmed on the phone. He will walk through engraving and delivery with you.";
  const call = el("a", { class: "btn btn-primary", id: "call-wilson", href: wilsonTel() });
  call.textContent = WILSON_PHONE;
  call.addEventListener("click", () => track(EVENTS.callClicked));
  const mailLine = el("p");
  mailLine.append(document.createTextNode("Or email "));
  const mail = el("a", { id: "email-wilson", href: "mailto:" + WILSON_EMAIL });
  mail.textContent = WILSON_EMAIL;
  mailLine.append(mail, document.createTextNode("."));
  callout.append(callTitle, callCopy, call, mailLine);

  const actions = el("div", { class: "actions no-print" });
  const send = el("button", { class: "btn btn-primary", type: "button", id: "send-quote" });
  send.textContent = "Send my quote to Wilson";
  const print = el("button", { class: "btn btn-ghost", type: "button", id: "print-quote" });
  print.textContent = "Print or save as PDF";
  print.addEventListener("click", () => window.print());
  const edit = el("button", { class: "btn btn-ghost", type: "button", id: "edit-gifts" });
  edit.textContent = "Edit gifts";
  edit.addEventListener("click", () => showCatalog());
  actions.append(send, print, edit);

  const confirmation = el("div", { id: "confirmation", role: "status" });
  confirmation.hidden = !state.sent;
  if (state.sent) confirmation.textContent = confirmationText();

  const status = el("p", { class: "form-note", id: "send-status", role: "status" });
  send.addEventListener("click", () => sendQuote(send, status, confirmation));

  mount.append(top, lines, totals, notes, callout, actions, confirmation, status);
  fillFigures(quote);
}

function confirmationText() {
  return "Wilson has your quote " + state.quoteNumber + ". He will confirm the price, engraving, and delivery. You can print this page or save it as a PDF in the meantime. Nothing is charged here.";
}

function showQuote() {
  show("quote");
  renderQuote();
}

function unlockPricing(event) {
  event.preventDefault();
  const contact = readContactFromForm();
  const errors = contactErrors(contact);
  ["firstName", "lastName", "business", "phone", "email", "province"].forEach((id) => fieldError(id, errors[id] || ""));
  const summary = document.getElementById("form-summary");
  const pieces = orderPieces();
  if (Object.keys(errors).length) {
    summary.textContent = "Add a first name, last name, business, valid phone, valid email, and province to see pricing.";
    document.getElementById("see-quote").disabled = true;
    return;
  }
  if (pieces < ORDER_MIN) {
    summary.textContent = pieces + " of 6 minimum. Add " + (ORDER_MIN - pieces) + " more gifts to see pricing. You can mix any items.";
    document.getElementById("see-quote").disabled = true;
    return;
  }
  summary.textContent = "";
  const digits = phoneDigits(contact.phone);
  contact.phone = formatPhone(digits);
  state.contact = contact;
  document.getElementById("phone").value = contact.phone;
  if (!state.quoteNumber) state.quoteNumber = quoteNumberNew();
  const wasUnlocked = state.unlocked;
  state.unlocked = true;
  showQuote();
  if (!wasUnlocked && !unlockTracked) {
    unlockTracked = true;
    track(EVENTS.pricingUnlocked);
  }
}

async function sendQuote(button, status, confirmation) {
  if (!state.unlocked || !state.quoteNumber) return;
  const quote = buildQuote();
  button.disabled = true;
  status.textContent = "Sending your quote…";
  const payload = {
    _subject: "New gift quote " + state.quoteNumber,
    _template: "table",
    _captcha: false,
    _replyto: state.contact.email,
    "Quote number": state.quoteNumber,
    "First name": state.contact.firstName,
    "Last name": state.contact.lastName,
    "Business": state.contact.business,
    "Phone": state.contact.phone,
    "Email": state.contact.email,
    "Province": state.contact.province,
    "Gifting type": state.giftingType,
    "Engraving": state.contact.engraving || "",
    "Engraving notes": state.contact.engravingNotes || "",
    "Occasion": state.contact.occasion || "",
    "Estimated volume": state.contact.volume || "",
    "Items": readableItems(quote),
    "Subtotal (CAD)": moneyNumber(quote.subtotalCents),
    "Shipping (CAD)": quote.shippingPending ? "Pending, Wilson will confirm" : moneyNumber(quote.shippingCents),
    "Tax (CAD)": taxSummary(quote),
    "Total (CAD)": moneyNumber(quote.totalCents),
    "Notes": "New logo set-up is a one-time $65 fee Wilson may waive. Engraved orders add 10 to 14 business days. Prices are estimates and Wilson confirms the final quote. The client pays in full. No payment was collected on the website."
  };
  try {
    const response = await fetch("https://formsubmit.co/ajax/executive.wilsonwong@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Request failed");
    state.sent = true;
    confirmation.hidden = false;
    confirmation.textContent = confirmationText();
    status.textContent = "";
    button.textContent = "Quote sent";
    track(EVENTS.quoteSent);
    trackLead(quote);
  } catch (err) {
    button.disabled = false;
    status.textContent = "That did not send. Please call Wilson and mention quote " + state.quoteNumber + ".";
  }
}

function chooseType(type) {
  if (type !== "Business" && type !== "Realtor") return;
  state.giftingType = type;
  state.collection = "All";
  state.search = "";
  const search = document.getElementById("search");
  if (search) search.value = "";
  showCatalog();
  track(EVENTS.typeSelected);
}

function bind() {
  document.getElementById("choose-realtor").addEventListener("click", () => chooseType("Realtor"));
  document.getElementById("choose-business").addEventListener("click", () => chooseType("Business"));
  document.getElementById("change-type").addEventListener("click", () => show("type"));
  document.getElementById("search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderFeature();
    renderGrid();
  });
  document.getElementById("continue-details").addEventListener("click", () => {
    if (!state.lines.length) return;
    if (state.unlocked) showQuote();
    else showDetails();
  });
  document.getElementById("back-to-gifts").addEventListener("click", () => showCatalog());
  const form = document.getElementById("details-form");
  const syncContact = () => {
    state.contact = readContactFromForm();
    refreshFormButton();
  };
  form.addEventListener("input", syncContact);
  form.addEventListener("change", syncContact);
  form.addEventListener("submit", unlockPricing);
  fillWilsonContact();
}

function fillWilsonContact() {
  const node = document.getElementById("wilson-contact");
  if (!node) return;
  node.replaceChildren();
  const tel = el("a", { href: wilsonTel() });
  tel.textContent = WILSON_PHONE;
  const mail = el("a", { href: "mailto:" + WILSON_EMAIL });
  mail.textContent = WILSON_EMAIL;
  node.append("Call or text ", tel, " or email ", mail, ".");
}

bind();
track(EVENTS.pageView);
