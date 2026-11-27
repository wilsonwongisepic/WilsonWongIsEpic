/* Word of the Year.
   WOTY_ENDPOINT is the deployed Apps Script web app (/exec).
   Fetch follows that app's 302 redirect by default. Do not set custom
   headers on the POST: a string body is sent as text/plain, which avoids
   a CORS preflight. An empty string falls back to FormSubmit, and the
   PDF is only the download on this page.
*/
(function () {
  var WOTY_YEAR = "2026";
  var WOTY_ENDPOINT = "https://script.google.com/macros/s/AKfycbz7y4ouQXVG8HG8UwclTc5SEWTlcmdhiiikSKHdXpzniyRA1nn0hU4zyJgkJG-XC3O7Zg/exec";
  var FORMSUBMIT_URL = "https://formsubmit.co/ajax/executive.wilsonwong@gmail.com";
  var WORD_BLOCK = "Let's pick a word that lifts you up. Please choose a positive word.";
  var STATEMENT_BLOCK = "Let's keep this uplifting. Please rephrase anything harsh.";
  var NAME_BLOCK = "Let's use a first name that can sit beside your word.";
  var SEED_MISSION = "To celebrate my community, relationships and my personal wins no matter how big or small they are.";

  if (typeof window !== "undefined" && typeof window.__WOTY_ENDPOINT === "string") {
    WOTY_ENDPOINT = window.__WOTY_ENDPOINT;
  }

  var SEED = {
    firstName: "Wilson",
    word: "CELEBRATE",
    mission: SEED_MISSION,
    vision: "",
    example: true
  };

  var form = document.getElementById("woty-form");
  if (!form || !window.WotyScreen) return;

  var step1 = document.getElementById("woty-step-1");
  var step2 = document.getElementById("woty-step-2");
  var step3 = document.getElementById("woty-step-3");
  var thanks = document.getElementById("woty-thanks");
  var community = document.getElementById("woty-community");
  var progress = document.getElementById("woty-progress");
  var live = document.getElementById("woty-step-live");
  var status = document.getElementById("woty-status");
  var wordInput = document.getElementById("woty-word");
  var nameInput = document.getElementById("woty-name");
  var missionInput = document.getElementById("woty-mission");
  var visionInput = document.getElementById("woty-vision");
  var emailInput = document.getElementById("woty-email");
  var emailHelp = document.getElementById("woty-email-help");
  var publicInput = document.getElementById("woty-public");
  var honey = document.getElementById("woty-company");
  var next1 = document.getElementById("woty-next-1");
  var next2 = document.getElementById("woty-next-2");
  var back2 = document.getElementById("woty-back-2");
  var back3 = document.getElementById("woty-back-3");
  var submitBtn = document.getElementById("woty-submit");
  var downloadBtn = document.getElementById("woty-download");
  var inbox = document.getElementById("woty-inbox");
  var kicker = document.getElementById("woty-preview-kicker");
  var previewWord = document.getElementById("woty-preview-word");
  var previewMission = document.getElementById("woty-preview-mission");
  var previewVision = document.getElementById("woty-preview-vision");
  var track = document.getElementById("woty-track");
  var marquee = document.getElementById("woty-marquee");
  var words = null;
  var busy = false;
  var draft = null;
  var lastEntries = [];

  if (!WOTY_ENDPOINT && emailHelp) {
    emailHelp.textContent = "Wilson receives this with your word. You'll download the PDF on the next screen.";
  }

  var wordsPromise = fetch("/assets/data/woty-words.json", { cache: "no-cache" }).then(function (response) {
    if (!response.ok) throw new Error("words");
    return response.json();
  }).then(function (data) {
    if (!data || !data.profanity || !data.negative || !data.review) throw new Error("words");
    words = data;
    form.setAttribute("data-ready", "true");
    return data;
  });

  wordsPromise.then(null, function () {
    if (status) status.textContent = "The word list did not load. Refresh the page.";
  });

  window.wotyDebug = {
    classify: function (text) { return words ? WotyScreen.classify(text, words) : ""; },
    submission: function (data) { return words ? WotyScreen.classifySubmission(data, words) : ""; },
    endpoint: WOTY_ENDPOINT
  };

  function setInvalid(input, message) {
    if (!input) return !message;
    var err = document.getElementById(input.id + "-error");
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (err) err.textContent = message;
      return false;
    }
    input.removeAttribute("aria-invalid");
    if (err) err.textContent = "";
    return true;
  }

  function focusInvalid() {
    var bad = form.querySelector("[aria-invalid='true']");
    if (bad && !bad.closest("[hidden]")) bad.focus();
  }

  function showStep(step) {
    step1.hidden = step !== 1;
    step2.hidden = step !== 2;
    step3.hidden = step !== 3;
    thanks.hidden = step !== 4;
    form.hidden = step === 4;
    if (community) community.hidden = step === 3;
    if (progress) {
      var dots = progress.querySelectorAll("li");
      for (var i = 0; i < dots.length; i++) {
        var n = i + 1;
        dots[i].classList.toggle("is-current", n === step);
        dots[i].classList.toggle("is-done", n < step || step === 4);
        if (n === step) dots[i].setAttribute("aria-current", "step");
        else dots[i].removeAttribute("aria-current");
      }
    }
    var labels = [
      "",
      "Step 1 of 3, your word.",
      "Step 2 of 3, mission and vision.",
      "Step 3 of 3, email.",
      "Your word is ready."
    ];
    if (live) live.textContent = labels[step] || "";
  }

  function validateWord() {
    if (!words) return false;
    var word = wordInput.value.trim();
    var name = nameInput.value.trim().replace(/\s+/g, " ");
    var ok = true;
    if (!word) ok = setInvalid(wordInput, "Enter one word.") && ok;
    else if (WotyScreen.blocked(WotyScreen.classify(word, words))) ok = setInvalid(wordInput, WORD_BLOCK) && ok;
    else if (!/^[A-Za-z]+(?:-[A-Za-z]+)*$/.test(word)) ok = setInvalid(wordInput, "Use one word made of letters and hyphens.") && ok;
    else if (word.length > 20) ok = setInvalid(wordInput, "Keep your word to 20 characters.") && ok;
    else setInvalid(wordInput, "");

    if (WotyScreen.blocked(WotyScreen.classify(name, words))) ok = setInvalid(nameInput, NAME_BLOCK) && ok;
    else if (name && name.length > 40) ok = setInvalid(nameInput, "Keep your first name to 40 characters.") && ok;
    else if (name && !/^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/.test(name)) ok = setInvalid(nameInput, "Use letters, spaces, hyphens, or apostrophes.") && ok;
    else setInvalid(nameInput, "");

    if (!ok) focusInvalid();
    return ok;
  }

  function checkStatement(input, emptyMessage) {
    if (!words) return false;
    var value = input.value.trim();
    if (!value) return setInvalid(input, emptyMessage);
    if (WotyScreen.blocked(WotyScreen.classify(input.value, words))) return setInvalid(input, STATEMENT_BLOCK);
    if (value.length > 300) return setInvalid(input, "Keep it to 300 characters.");
    return setInvalid(input, "");
  }

  function validateStatements() {
    var missionOk = checkStatement(missionInput, "Add a mission statement.");
    var visionOk = checkStatement(visionInput, "Add a vision statement.");
    if (!missionOk || !visionOk) focusInvalid();
    return missionOk && visionOk;
  }

  function validateEmail() {
    var email = emailInput.value.trim();
    var ok;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ok = setInvalid(emailInput, "Add an email address.");
    else if (email.length > 120) ok = setInvalid(emailInput, "That email is too long.");
    else ok = setInvalid(emailInput, "");
    if (!ok) focusInvalid();
    return ok;
  }

  function whenReady(fn) {
    wordsPromise.then(fn, function () {
      status.textContent = "The word list did not load. Refresh the page.";
    });
  }

  function readDraft() {
    return {
      firstName: nameInput.value.trim().replace(/\s+/g, " "),
      word: wordInput.value.trim().toUpperCase(),
      mission: missionInput.value.trim(),
      vision: visionInput.value.trim(),
      email: emailInput.value.trim(),
      showPublic: !!publicInput.checked
    };
  }

  function displayTitle(name) {
    return (name ? name + "'s " : "My ") + WOTY_YEAR + " Word of the Year";
  }

  function fillPreview(data) {
    kicker.textContent = displayTitle(data.firstName);
    previewWord.textContent = data.word;
    previewMission.textContent = data.mission;
    previewVision.textContent = data.vision;
  }

  function failSend(message) {
    status.textContent = message || "That did not send. Try again in a moment, or email executive.wilsonwong@gmail.com.";
  }

  function postScript(payload) {
    return fetch(WOTY_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        firstName: payload.firstName,
        email: payload.email,
        word: payload.word,
        mission: payload.mission,
        vision: payload.vision,
        showPublic: payload.showPublic,
        company: honey.value
      })
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (err) { data = null; }
        if (!response.ok || !data || data.ok !== true) return { ok: false, error: data && data.error };
        if (WotyScreen.blocked(data.flagged)) return { ok: true, blocked: true };
        return { ok: true, emailed: data.emailed, via: "script" };
      });
    });
  }

  function postForm(payload) {
    var body = {
      _subject: "Website: " + WOTY_YEAR + " Word of the Year from " + (payload.firstName || "someone") + " — " + payload.word,
      _template: "table",
      _captcha: false,
      _replyto: payload.email,
      _honey: "",
      "First name": payload.firstName,
      Email: payload.email,
      Word: payload.word,
      Mission: payload.mission,
      Vision: payload.vision,
      "Show publicly": payload.showPublic ? "TRUE" : "FALSE",
      Page: location.pathname
    };
    return fetch(FORMSUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (!response.ok) throw new Error("form");
      return { ok: true, via: "form" };
    });
  }

  function finish(payload, result) {
    if (result && result.blocked) {
      status.textContent = WORD_BLOCK;
      return;
    }
    if (!result || result.ok === false) {
      failSend(result && result.error);
      return;
    }
    draft = payload;
    fillPreview(payload);
    if (result.via === "form") inbox.textContent = "Wilson has your word. Download your printable PDF here.";
    else if (result.emailed === false) inbox.textContent = "Your word is saved. The email did not send, so download the PDF here.";
    else inbox.textContent = "Check your inbox for your printable PDF.";
    showStep(4);
  }

  function submitForm() {
    if (busy) return;
    if (honey && honey.value.trim()) return;
    whenReady(function () {
      if (!validateWord()) { showStep(1); focusInvalid(); return; }
      if (!validateStatements()) { showStep(2); focusInvalid(); return; }
      if (!validateEmail()) return;
      var payload = readDraft();
      var reason = WotyScreen.classifySubmission(payload, words);
      if (WotyScreen.blocked(reason)) {
        if (WotyScreen.blocked(WotyScreen.classify(payload.word, words)) || WotyScreen.blocked(WotyScreen.classify(payload.firstName, words))) {
          showStep(1);
          validateWord();
        } else {
          showStep(2);
          validateStatements();
        }
        return;
      }
      busy = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      status.textContent = "";
      var request = WOTY_ENDPOINT ? postScript(payload) : postForm(payload);
      request.then(function (result) { finish(payload, result); }).catch(function () { failSend(); }).then(function () {
        busy = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Email me my WOTY";
        }
      });
    });
  }

  function bindCount(input, countId, max) {
    var count = document.getElementById(countId);
    function update() {
      if (input.value.length > max) input.value = input.value.slice(0, max);
      if (count) count.textContent = input.value.length + " / " + max;
      setInvalid(input, "");
    }
    input.addEventListener("input", update);
    update();
  }

  wordInput.addEventListener("input", function () { setInvalid(wordInput, ""); status.textContent = ""; });
  nameInput.addEventListener("input", function () { setInvalid(nameInput, ""); });
  emailInput.addEventListener("input", function () { setInvalid(emailInput, ""); status.textContent = ""; });
  bindCount(missionInput, "woty-mission-count", 300);
  bindCount(visionInput, "woty-vision-count", 300);

  next1.addEventListener("click", function () {
    whenReady(function () {
      if (validateWord()) showStep(2);
    });
  });
  next2.addEventListener("click", function () {
    whenReady(function () {
      if (validateStatements()) showStep(3);
    });
  });
  back2.addEventListener("click", function () { showStep(1); });
  back3.addEventListener("click", function () { showStep(2); });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (step3.hidden) return;
    submitForm();
  });
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.target.tagName === "TEXTAREA") return;
    if (!step1.hidden) { event.preventDefault(); next1.click(); }
    else if (!step2.hidden) { event.preventDefault(); next2.click(); }
  });

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function cardHtml(entry, hidden) {
    var name = escapeHtml(entry.firstName);
    var word = escapeHtml(entry.word);
    var mission = escapeHtml(entry.mission);
    var vision = escapeHtml(entry.vision);
    var attrs = hidden ? " aria-hidden=\"true\"" : "";
    if (entry.example) attrs += " data-example=\"true\"";
    var body = "";
    if (entry.example) {
      if (mission) body = "<p class=\"woty-card-text\">" + mission + "</p>";
    } else {
      if (mission) body += "<p class=\"woty-card-label\">Mission</p><p class=\"woty-card-text\">" + mission + "</p>";
      if (vision) body += "<p class=\"woty-card-label\">Vision</p><p class=\"woty-card-text\">" + vision + "</p>";
    }
    return "<article class=\"woty-card\"" + attrs + ">"
      + (entry.example ? "<p class=\"woty-card-tag\">Example</p>" : "")
      + "<p class=\"woty-card-word\">" + word + "</p>"
      + (name ? "<p class=\"woty-card-name\">" + name + "</p>" : "")
      + body
      + "</article>";
  }

  function cleanEntry(row) {
    if (!row || typeof row !== "object") return null;
    var word = String(row.word || "").trim();
    if (!word) return null;
    return {
      firstName: String(row.firstName || "").trim().slice(0, 40),
      word: word.slice(0, 40),
      mission: String(row.mission || "").trim().slice(0, 300),
      vision: String(row.vision || "").trim().slice(0, 300)
    };
  }

  function withSeed(entries) {
    var rest = [];
    (entries || []).forEach(function (entry) {
      var sameName = String(entry.firstName || "").trim().toLowerCase() === "wilson";
      var sameWord = String(entry.word || "").trim().toUpperCase() === "CELEBRATE";
      if (!(sameName && sameWord)) rest.push(entry);
    });
    return [SEED].concat(rest);
  }

  function widen(items) {
    var out = items.map(function (item) { return { item: item, pad: false }; });
    var guard = 0;
    while (out.length < 4 && guard < 4) {
      items.forEach(function (item) { out.push({ item: item, pad: true }); });
      guard += 1;
    }
    return out;
  }

  function setHtml(items, hideAll) {
    return items.map(function (wrapped) {
      return cardHtml(wrapped.item, hideAll || wrapped.pad);
    }).join("");
  }

  function renderScroll(entries) {
    lastEntries = entries || [];
    if (!track || !marquee) return;
    var items = withSeed(lastEntries);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var shown = reduce ? items.map(function (item) { return { item: item, pad: false }; }) : widen(items);
    var html = "<div class=\"woty-set\">" + setHtml(shown, false) + "</div>";
    if (!reduce) html += "<div class=\"woty-set\" aria-hidden=\"true\">" + setHtml(shown, true) + "</div>";
    track.innerHTML = html;
    marquee.classList.toggle("is-animated", !reduce);
  }

  function loadList() {
    renderScroll([]);
    if (!WOTY_ENDPOINT) return;
    var join = WOTY_ENDPOINT.indexOf("?") === -1 ? "?" : "&";
    fetch(WOTY_ENDPOINT + join + "action=list", { cache: "no-store" }).then(function (response) {
      return response.text();
    }).then(function (text) {
      var data = JSON.parse(text);
      var list = Array.isArray(data) ? data : (data && data.entries) || [];
      var cleaned = [];
      list.forEach(function (row) {
        var entry = cleanEntry(row);
        if (entry) cleaned.push(entry);
      });
      renderScroll(cleaned);
    }).catch(function () { renderScroll([]); });
  }

  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.addEventListener) motion.addEventListener("change", function () { renderScroll(lastEntries); });
  loadList();

  function fileName(word) {
    var safe = String(word || "word").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (safe || "word") + "-" + WOTY_YEAR + "-word-of-the-year.pdf";
  }

  function pdfSafe(value) {
    return String(value || "")
      .replace(/\u2019/g, "'")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  }

  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
      script.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error("pdf"));
      };
      script.onerror = function () { reject(new Error("pdf")); };
      document.head.appendChild(script);
    });
  }

  function makePdf(data) {
    return loadJsPdf().then(function (JsPDF) {
      var doc = new JsPDF({ unit: "pt", format: "letter" });
      var pageW = 612;
      var pageH = 792;
      var margin = 64;
      var width = pageW - margin * 2;
      doc.setFillColor(246, 240, 227);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setFillColor(47, 107, 79);
      doc.rect(0, 0, pageW, 16, "F");
      doc.setFillColor(29, 70, 52);
      doc.rect(0, pageH - 36, pageW, 36, "F");
      doc.setTextColor(246, 240, 227);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text("wilsonwongisepic.com", pageW / 2, pageH - 14, { align: "center" });

      doc.setTextColor(168, 132, 78);
      doc.setFont("times", "italic");
      doc.setFontSize(16);
      var titleLines = doc.splitTextToSize(pdfSafe(displayTitle(data.firstName)), width);
      doc.text(titleLines, pageW / 2, 78, { align: "center" });

      var size = 54;
      var wordLines = [];
      doc.setFont("times", "bold");
      doc.setTextColor(29, 70, 52);
      var safeWord = pdfSafe(data.word || "");
      while (size >= 28) {
        doc.setFontSize(size);
        wordLines = doc.splitTextToSize(safeWord, width);
        if (wordLines.length <= 2) break;
        size -= 4;
      }
      var wordY = 78 + titleLines.length * 22 + 36;
      doc.text(wordLines, pageW / 2, wordY, { align: "center" });
      var y = wordY + wordLines.length * (size * 0.9) + 18;
      doc.setDrawColor(168, 132, 78);
      doc.setLineWidth(1.5);
      doc.line(pageW / 2 - 70, y, pageW / 2 + 70, y);
      y += 32;

      function section(label, text) {
        var body = pdfSafe(text);
        if (!body) return;
        if (y > pageH - 80) return;
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.setTextColor(47, 107, 79);
        doc.text(label.toUpperCase(), margin, y);
        y += 16;
        doc.setFont("times", "italic");
        doc.setFontSize(13);
        doc.setTextColor(29, 35, 42);
        var lines = doc.splitTextToSize(body, width);
        var room = Math.max(0, Math.floor((pageH - 64 - y) / 17));
        if (lines.length > room) lines = lines.slice(0, room);
        if (!lines.length) return;
        doc.text(lines, margin, y);
        y += lines.length * 17 + 20;
      }
      section("Mission", data.mission);
      section("Vision", data.vision);
      doc.save(fileName(data.word));
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      if (!draft) return;
      var label = downloadBtn.textContent;
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Preparing PDF…";
      makePdf(draft).catch(function () { window.print(); }).then(function () {
        downloadBtn.disabled = false;
        downloadBtn.textContent = label;
      });
    });
  }

  showStep(1);
})();
