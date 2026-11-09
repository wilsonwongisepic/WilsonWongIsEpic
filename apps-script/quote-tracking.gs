/**
 * Gift quote log for Wilson Wong.
 *
 * The website sends two kinds of messages to this script.
 * A normal event (someone opened the page, added a gift, and so on)
 * is added to the "Activity Log" tab.
 * A finished quote is added to the "Leads" tab.
 *
 * The Timestamp cell is a real date (new Date()), not text,
 * so a weekly formula in Google Sheets can use it.
 * Gifting Type is stored as Business or Realtor.
 * Event names are stored exactly as the site sends them.
 * Leads Status is always New when the row is created.
 *
 * How to turn this on
 * 1. Open Google Sheets and create a spreadsheet. Name it something you will recognise, such as "Wilson gift quotes".
 * 2. Click Extensions, then Apps Script.
 * 3. Select any sample code in the editor and delete it.
 * 4. Paste this whole file in its place. Click the save icon (or Ctrl+S).
 * 5. Click Deploy, then New deployment.
 * 6. Next to "Select type", click the gear and choose Web app.
 * 7. Description: Gift quote log.
 * 8. Execute as: Me (your Google account).
 * 9. Who has access: Anyone.
 * 10. Click Deploy. If Google asks you to allow access, choose your account and allow it.
 * 11. Copy the Web app URL. It looks like https://script.google.com/macros/s/…/exec
 * 12. Open sharp/quote.js in this project. Paste the URL between the quotes on the TRACKING_ENDPOINT line. Leave the quotes in place.
 * 13. Publish that change. Until TRACKING_ENDPOINT has a URL, the website does not send anything here.
 *
 * The first message creates the "Activity Log" and "Leads" tabs and their column titles.
 * Do not rename those tabs. You can sort and filter them like any other sheet.
 * New leads show Status "New". Change that cell yourself when you have called them back.
 */

var ACTIVITY_HEADERS = [
  "Timestamp",
  "Event",
  "Session ID",
  "Quote #",
  "Gifting Type",
  "Items Selected",
  "Total Quantity",
  "Est. Subtotal (CAD)",
  "Province",
  "Page",
  "Referrer",
  "Device"
];

var LEADS_HEADERS = [
  "Timestamp",
  "Quote #",
  "First Name",
  "Last Name",
  "Business",
  "Phone",
  "Email",
  "Province",
  "Gifting Type",
  "Items",
  "Total Quantity",
  "Subtotal",
  "Shipping",
  "Tax",
  "Total",
  "Status"
];

function doGet() {
  return ContentService
    .createTextOutput("Wilson's gift quote log is running. The quote page sends activity here. There is nothing to view at this address.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = {};
  try {
    data = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
  } catch (err) {
    data = {};
  }

  if (data.type === "lead") {
    var leads = sheetWithHeaders_(ss, "Leads", LEADS_HEADERS);
    leads.appendRow([
      new Date(),
      data.quoteNumber || "",
      data.firstName || "",
      data.lastName || "",
      data.business || "",
      data.phone || "",
      data.email || "",
      data.province || "",
      data.giftingType || "",
      data.items || "",
      numberOrBlank_(data.totalQuantity),
      data.subtotal || "",
      data.shipping || "",
      data.tax || "",
      data.total || "",
      "New"
    ]);
    stampDate_(leads);
  } else {
    var log = sheetWithHeaders_(ss, "Activity Log", ACTIVITY_HEADERS);
    log.appendRow([
      new Date(),
      data.event || "",
      data.sessionId || "",
      data.quoteNumber || "",
      data.giftingType || "",
      data.itemsSelected || "",
      numberOrBlank_(data.totalQuantity),
      numberOrBlank_(data.estSubtotal),
      data.province || "",
      data.page || "",
      data.referrer || "",
      data.device || ""
    ]);
    stampDate_(log);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetWithHeaders_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function stampDate_(sheet) {
  sheet.getRange(sheet.getLastRow(), 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
}

function numberOrBlank_(value) {
  if (value === 0 || value === "0") return 0;
  if (value === undefined || value === null || value === "") return "";
  return value;
}
