/**
 * Word of the Year for wilsonwongisepic.com.
 *
 * Bound to the Google Sheet "WOTY 2026 Submissions", owned by
 * executive.wilsonwong@gmail.com so MailApp sends as that account.
 *
 * Deploy steps are in README.md next to this file.
 * The screening code and the word lists below are copies of
 * assets/js/woty-screen.js and assets/data/woty-words.json.
 * Edit the site files, paste the same text between the markers, and
 * deploy a new web app version.
 */

/* WOTY_SCREEN_START */
/* Word of the Year screening. Loaded by the page and pasted into
   backend/woty-apps-script/Code.gs (between the screen markers). Keep those
   copies identical. The word lists live in assets/data/woty-words.json.

   A match is a whole word, not a hidden string inside a longer word.
   classic, hello, skill, diet, grape, cocktail, passion, and ambassador
   do not match. Spaced letters (k i l l), dotted letters (k.i.l.l),
   and obvious swaps (0, 1, 3, 4, 5, 7, @, $, *) do match.
*/
var WotyScreen = (function () {
  var SUFFIXES = ["ness", "ing", "ers", "ful", "ly", "ed", "er", "es", "s", "d"];

  /* Skeletons left after * or _ are removed. "s**t" becomes "st".
     Only tokens that actually contain * or _ use this map, so "sit" is fine. */
  var STAR_MAP = {
    fk: "fuck",
    fuk: "fuck",
    fck: "fuck",
    sht: "shit",
    st: "shit",
    sit: "shit",
    btch: "bitch",
    bch: "bitch",
    dck: "dick",
    cnt: "cunt",
    dmn: "damn",
    dn: "damn",
    ps: "pussy",
    hte: "hate",
    kll: "kill"
  };

  /* Two initials joined by dots, such as P.S., must not become a word.
     f.k is the short evasion worth catching. */
  var RUN2_MAP = { fk: "fuck" };

  function leet(value) {
    return String(value || "").toLowerCase()
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      .replace(/8/g, "b")
      .replace(/9/g, "g")
      .replace(/@/g, "a")
      .replace(/\$/g, "s")
      .replace(/!/g, "i")
      .replace(/\|/g, "i")
      .replace(/\+/g, "t");
  }

  function normLetters(letters) {
    var primary = letters.replace(/([a-z])\1{2,}/g, "$1");
    var loose = letters.replace(/([a-z])\1+/g, "$1");
    return {
      primary: primary,
      loose: loose,
      hadLongRepeat: /([a-z])\1{2,}/.test(letters)
    };
  }

  function suffixHit(primary, listPrimary) {
    var i, suf, stem;
    for (i = 0; i < SUFFIXES.length; i++) {
      suf = SUFFIXES[i];
      if (primary.length < suf.length + 3) continue;
      if (primary.substring(primary.length - suf.length) !== suf) continue;
      stem = primary.substring(0, primary.length - suf.length);
      if (stem === listPrimary) return true;
    }
    return false;
  }

  function sameToken(inputLetters, listLetters) {
    var n = normLetters(inputLetters);
    var list = normLetters(listLetters);
    if (!n.primary || !list.primary) return false;
    if (n.primary === list.primary) return true;
    if (suffixHit(n.primary, list.primary)) return true;
    if (n.loose.length >= 3 && n.loose === list.loose && inputLetters.length > listLetters.length) return true;
    if (n.hadLongRepeat && n.primary === n.loose && n.loose.length >= 2 && n.loose === list.loose) return true;
    return false;
  }

  function pushRun(out, run) {
    if (!run) return;
    if (run.length >= 3) out.push(run);
    else if (RUN2_MAP[run]) out.push(RUN2_MAP[run]);
  }

  function candidates(text) {
    var raw = String(text || "");
    var parts = leet(raw).split(/[^a-z]+/);
    var out = [];
    var run = "";
    var i, bit, skeleton, bits;
    for (i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      out.push(parts[i]);
      if (parts[i].length === 1) run += parts[i];
      else {
        pushRun(out, run);
        run = "";
      }
    }
    pushRun(out, run);
    bits = raw.toLowerCase().match(/[a-z0-9@$!|+*_]*[*_][a-z0-9@$!|+*_]*/g) || [];
    for (i = 0; i < bits.length; i++) {
      bit = bits[i];
      skeleton = leet(bit).replace(/[^a-z]/g, "");
      if (STAR_MAP[skeleton]) out.push(STAR_MAP[skeleton]);
      else if (skeleton.length >= 3) out.push(skeleton);
    }
    return out;
  }

  function prepared(lists) {
    var groups = ["profanity", "negative", "review"];
    var out = { profanity: [], negative: [], review: [] };
    var g, i, letters, src, name;
    for (g = 0; g < groups.length; g++) {
      name = groups[g];
      src = (lists && lists[name]) || [];
      for (i = 0; i < src.length; i++) {
        letters = leet(src[i]).replace(/[^a-z]/g, "");
        if (letters) out[name].push(letters);
      }
    }
    return out;
  }

  function classify(text, lists) {
    var found = { profanity: false, negative: false, review: false };
    var groups = ["profanity", "negative", "review"];
    var ready = prepared(lists);
    var cands = candidates(text);
    var i, g, j, name;
    for (i = 0; i < cands.length; i++) {
      for (g = 0; g < groups.length; g++) {
        name = groups[g];
        for (j = 0; j < ready[name].length; j++) {
          if (sameToken(cands[i], ready[name][j])) found[name] = true;
        }
      }
    }
    if (found.profanity) return "profanity";
    if (found.negative) return "negative";
    if (found.review) return "ambiguous";
    return "";
  }

  /* Name hits on the review list are ignored. Rich is a name.
     Review hits in the word, mission, or vision are ambiguous. */
  function classifySubmission(data, lists) {
    data = data || {};
    var word = classify(data.word, lists);
    var mission = classify(data.mission, lists);
    var vision = classify(data.vision, lists);
    var name = classify(data.firstName, lists);
    if (name === "ambiguous") name = "";
    if (word === "profanity" || mission === "profanity" || vision === "profanity" || name === "profanity") return "profanity";
    if (word === "negative" || mission === "negative" || vision === "negative" || name === "negative") return "negative";
    if (word === "ambiguous" || mission === "ambiguous" || vision === "ambiguous") return "ambiguous";
    return "";
  }

  function blocked(reason) {
    return reason === "profanity" || reason === "negative";
  }

  return {
    classify: classify,
    classifySubmission: classifySubmission,
    blocked: blocked
  };
})();
/* WOTY_SCREEN_END */

var WORD_LISTS =
/* WOTY_WORDS_START */
{
  "profanity": [
    "anal",
    "anus",
    "arse",
    "ass",
    "asshole",
    "azz",
    "bastard",
    "beaner",
    "biatch",
    "bitch",
    "bitchy",
    "blowjob",
    "bollocks",
    "boner",
    "btch",
    "bullshit",
    "chink",
    "clusterfuck",
    "cnt",
    "cock",
    "cocksucker",
    "cok",
    "coon",
    "crap",
    "crappy",
    "cunt",
    "cum",
    "damn",
    "dammit",
    "damnit",
    "dick",
    "dickhead",
    "dik",
    "dildo",
    "dipshit",
    "dmn",
    "dong",
    "douche",
    "douchebag",
    "dumbass",
    "dyke",
    "fag",
    "faggot",
    "fck",
    "fock",
    "fuck",
    "fuq",
    "fuk",
    "fvck",
    "goddamn",
    "goddammit",
    "goddamnit",
    "gook",
    "handjob",
    "hell",
    "hellish",
    "jackass",
    "jizz",
    "kike",
    "lmfao",
    "milf",
    "motherfucker",
    "motherfucking",
    "negro",
    "nigga",
    "nigger",
    "paki",
    "phuck",
    "phuk",
    "piss",
    "porn",
    "prick",
    "pussies",
    "pussy",
    "raghead",
    "retard",
    "shit",
    "shithead",
    "shitty",
    "sht",
    "shyt",
    "skank",
    "slut",
    "slutty",
    "spic",
    "stfu",
    "tit",
    "tits",
    "towelhead",
    "tranny",
    "twat",
    "wank",
    "wanker",
    "wetback",
    "whore",
    "wop",
    "wtf"
  ],
  "negative": [
    "abuse",
    "abusive",
    "abusing",
    "annihilate",
    "bomb",
    "bomber",
    "cruel",
    "cruelty",
    "dead",
    "deadly",
    "death",
    "destroy",
    "destruction",
    "die",
    "died",
    "dies",
    "dying",
    "evil",
    "genocidal",
    "genocide",
    "hate",
    "hateful",
    "hater",
    "hating",
    "hatred",
    "hopeless",
    "kill",
    "killer",
    "killing",
    "murder",
    "murderer",
    "nazi",
    "racism",
    "racist",
    "rape",
    "raping",
    "rapist",
    "revenge",
    "slaughter",
    "suicidal",
    "suicide",
    "terror",
    "terrorism",
    "terrorist",
    "torture",
    "torturing",
    "useless",
    "violence",
    "violent",
    "worthless"
  ],
  "review": [
    "beast",
    "control",
    "controlling",
    "dominance",
    "dominate",
    "domination",
    "money",
    "power",
    "powerful",
    "rich",
    "riches",
    "ruthless",
    "savage",
    "sex",
    "sexier",
    "sexiest",
    "sexual",
    "sexy",
    "toxic"
  ]
}
/* WOTY_WORDS_END */
;

var WOTY_YEAR = "2026";
var MAX_PER_HOUR = 5;
var HEADERS = [
  "Timestamp",
  "First name",
  "Email",
  "Word",
  "Mission",
  "Vision",
  "Show publicly",
  "Hidden",
  "Flagged"
];

function doGet(e) {
  try {
    var action = e && e.parameter ? String(e.parameter.action || "") : "";
    if (action === "list") return json_({ ok: true, entries: listPublic_() });
    return json_({ ok: true, service: "woty" });
  } catch (err) {
    console.log(err);
    return json_({ ok: false, error: "The word list is unavailable right now." });
  }
}

function doPost(e) {
  try {
    return doPost_(e);
  } catch (err) {
    console.log(err);
    return json_({ ok: false, error: "Something went wrong saving your word. Please try again." });
  }
}

function doPost_(e) {
  var data = readBody_(e);
  if (String(data.company || data.website || data._honey || "").trim()) {
    return json_({ ok: true, emailed: false });
  }

  var email = oneLine_(data.email).slice(0, 120);
  if (!validEmail_(email)) return json_({ ok: false, error: "Use a valid email address." });

  var rawWord = clip_(data.word, 500);
  if (!oneLine_(rawWord)) return json_({ ok: false, error: "Enter one word." });

  var reason = WotyScreen.classifySubmission({
    word: rawWord,
    mission: clip_(data.mission, 5000),
    vision: clip_(data.vision, 5000),
    firstName: clip_(data.firstName, 80)
  }, WORD_LISTS);

  var hard = reason === "profanity" || reason === "negative";
  var cleanWord = cleanWord_(data.word);
  if (!hard) {
    if (!wordShapeOk_(data.word)) {
      return json_({ ok: false, error: "Use one word made of letters and hyphens." });
    }
    if (!clip_(data.mission, 300) || !clip_(data.vision, 300)) {
      return json_({ ok: false, error: "Add a mission statement and a vision statement." });
    }
  }

  if (rateLimited_(email)) {
    return json_({ ok: false, error: "Too many submissions from this email. Please try again in about an hour." });
  }

  var textMax = reason ? 1000 : 300;
  var stored = {
    firstName: hard ? clip_(oneLine_(data.firstName), 40) : cleanName_(data.firstName),
    email: email,
    word: hard ? clip_(oneLine_(data.word), 80) : cleanWord,
    mission: clip_(data.mission, textMax),
    vision: clip_(data.vision, textMax),
    showPublic: asBool_(data.showPublic)
  };

  var sheet = submissions_();
  sheet.appendRow([
    new Date(),
    safeCell_(stored.firstName),
    safeCell_(stored.email),
    safeCell_(stored.word),
    safeCell_(stored.mission),
    safeCell_(stored.vision),
    stored.showPublic ? "TRUE" : "FALSE",
    "",
    reason ? "TRUE (" + reason + ")" : ""
  ]);
  var row = sheet.getLastRow();
  sheet.getRange(row, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  if (reason) sheet.getRange(row, 1, 1, HEADERS.length).setBackground("#f4c7c3");

  var emailed = false;
  if (reason !== "profanity" && reason !== "negative") {
    try {
      sendPdf_(stored);
      emailed = true;
    } catch (mailErr) {
      console.log(mailErr);
      emailed = false;
    }
  }

  return json_({ ok: true, emailed: emailed, flagged: reason || "" });
}

function listPublic_() {
  var sheet = submissions_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  var i, row, word;
  for (i = values.length - 1; i >= 0 && out.length < 50; i--) {
    row = values[i];
    if (!isTrue_(row[6])) continue;
    if (isTrue_(row[7])) continue;
    if (isFlagged_(row[8])) continue;
    word = String(row[3] || "").trim();
    if (!word) continue;
    out.push({
      firstName: String(row[1] || "").trim(),
      word: word,
      mission: String(row[4] || "").trim(),
      vision: String(row[5] || "").trim()
    });
  }
  return out;
}

function submissions_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Submissions");
  if (!sheet) {
    var first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0) {
      first.setName("Submissions");
      sheet = first;
    } else {
      sheet = ss.insertSheet("Submissions");
    }
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setColumnWidth(5, 320);
    sheet.setColumnWidth(6, 320);
  }
  return sheet;
}

function sendPdf_(data) {
  var html = pdfHtml_(data);
  var blob = Utilities.newBlob(html, "text/html", "word-of-the-year.html").getAs("application/pdf");
  blob.setName(fileName_(data.word));
  var subject = "Your " + WOTY_YEAR + " Word of the Year: " + oneLine_(data.word).slice(0, 80);
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: emailBody_(data),
    attachments: [blob]
  });
}

function emailBody_(data) {
  var who = data.firstName ? data.firstName : "there";
  return "Hi " + who + ",\n\n"
    + "Your " + WOTY_YEAR + " Word of the Year is " + data.word + ".\n\n"
    + "A one-page printable is attached. Keep it somewhere you will see it on the hard days, and on the days you need to stay humble.\n\n"
    + "Wilson\n"
    + "wilsonwongisepic.com\n";
}

function pdfHtml_(data) {
  var title = data.firstName
    ? escapeHtml_(data.firstName) + "'s " + WOTY_YEAR + " Word of the Year"
    : "My " + WOTY_YEAR + " Word of the Year";
  var blocks = block_("Mission", data.mission) + block_("Vision", data.vision);
  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>"
    + "@page{size:letter;margin:0}"
    + "html,body{margin:0;padding:0}"
    + "body{background:#f6f0e3;color:#1d4634;font-family:Georgia,'Times New Roman',serif}"
    + ".page{box-sizing:border-box;min-height:11in;padding:0.7in 0.75in 0.9in;position:relative}"
    + ".bar{position:absolute;left:0;right:0;top:0;height:14px;background:#2f6b4f}"
    + ".foot{position:absolute;left:0;right:0;bottom:0;height:36px;background:#1d4634;color:#f6f0e3;"
    + "text-align:center;line-height:36px;font-size:12px;letter-spacing:0.08em}"
    + "h1{font-size:18px;font-weight:normal;font-style:italic;color:#a8844e;text-align:center;margin:36px 0 12px}"
    + ".word{font-size:64px;line-height:0.95;text-align:center;color:#1d4634;margin:0 0 18px;word-wrap:break-word}"
    + ".rule{width:160px;height:2px;background:#a8844e;margin:0 auto 8px;border:0}"
    + "h2{font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#2f6b4f;margin:22px 0 8px}"
    + "p{font-size:15px;line-height:1.45;margin:0;color:#1d232a}"
    + "</style></head><body><div class=\"page\"><div class=\"bar\"></div>"
    + "<h1>" + title + "</h1>"
    + "<p class=\"word\">" + escapeHtml_(data.word) + "</p>"
    + "<div class=\"rule\"></div>"
    + blocks
    + "<div class=\"foot\">wilsonwongisepic.com</div></div></body></html>";
}

function block_(label, text) {
  if (!String(text || "").trim()) return "";
  return "<h2>" + label + "</h2><p>" + escapeHtml_(text).replace(/\n/g, "<br>") + "</p>";
}

function fileName_(word) {
  var safe = String(word || "word").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!safe) safe = "word";
  return safe + "-" + WOTY_YEAR + "-word-of-the-year.pdf";
}

function readBody_(e) {
  var raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : "";
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (err) {
      /* A form post falls through to the parameter map. */
    }
  }
  return (e && e.parameter) || {};
}

function rateLimited_(email) {
  var cache = CacheService.getScriptCache();
  var key = "woty:" + String(email || "").toLowerCase();
  var current = parseInt(cache.get(key) || "0", 10);
  if (isNaN(current)) current = 0;
  if (current >= MAX_PER_HOUR) return true;
  cache.put(key, String(current + 1), 3600);
  return false;
}

function wordShapeOk_(value) {
  var word = String(value || "").trim();
  if (!word || word.length > 20) return false;
  return /^[A-Za-z]+(?:-[A-Za-z]+)*$/.test(word);
}

function cleanWord_(value) {
  return String(value || "").trim().toUpperCase();
}

function cleanName_(value) {
  var name = oneLine_(value).replace(/\s+/g, " ");
  name = name.replace(/[^A-Za-z .'-]/g, "");
  name = name.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  return name.slice(0, 40);
}

function validEmail_(email) {
  if (!email || email.length > 120 || /[\r\n]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function asBool_(value) {
  if (value === true) return true;
  var text = String(value == null ? "" : value).trim().toUpperCase();
  return text === "TRUE" || text === "1" || text === "YES" || text === "ON";
}

function isTrue_(value) {
  return String(value == null ? "" : value).trim().toUpperCase() === "TRUE";
}

function isFlagged_(value) {
  var text = String(value == null ? "" : value).trim().toUpperCase();
  if (!text || text === "FALSE") return false;
  return text.indexOf("TRUE") === 0;
}

function oneLine_(value) {
  return String(value == null ? "" : value).replace(/[\r\n]+/g, " ").trim();
}

function clip_(value, max) {
  var text = String(value == null ? "" : value).replace(/\r\n/g, "\n").trim();
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function safeCell_(value) {
  var text = String(value == null ? "" : value);
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
