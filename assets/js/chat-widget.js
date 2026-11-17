/* Dee Dee — Wilson's closing-gifts assistant.
   A guided chat. No API key lives here. Nothing is stored except whether
   the panel is open, and only for this browser tab.

   CHAT_ENDPOINT stays "" until a real assistant exists.
   getReply() is the only function that would call it.
   Set CHAT_ENDPOINT to your own HTTPS URL (not a third-party script).
   It should accept POST JSON:
     { "message": "what they typed or the button label", "choice": "gifts|speaking|coaching|access|quote|packages|steps|ask or empty", "page": "/closing-gifts.html" }
   and return JSON:
     {
       "text": "Dee Dee's reply",
       "replies": [{ "label": "Build my gift quote", "choice": "quote", "primary": true }],
       "steps": [["Step title", "Step detail already published on the site"]],
       "form": { "topic": "coaching", "subject": "Coaching enquiry" },
       "link": { "href": "/coaching.html", "label": "Coaching page", "newTab": false },
       "navigate": "/closing-gifts.html",
       "openTab": "/sharp/"
     }
   href, navigate, and openTab must be same-site paths starting with a single "/".
   While CHAT_ENDPOINT is empty, getReply() uses the rules in ruleReply().
   Those rules only repeat facts already on this website.
*/
(function () {
  if (document.getElementById("dd-chat")) return;

  var CHAT_ENDPOINT = "";
  var FORMSUBMIT_URL = "https://formsubmit.co/ajax/executive.wilsonwong@gmail.com";
  var OPEN_KEY = "ww-dd-open";
  var NUDGE_KEY = "ww-dd-nudged";
  var GREETING = "What are you looking for today? Are you looking for access to Wilson? Or are you looking for public speaking? Are you looking for coaching? Or most importantly, are you looking for closing gifts?";
  var WILSON_NOTE = "That's Wilson's department. Leave your name and how to reach you, and I'll let Wilson know so he can get back to you.";
  var NAV_DELAY = 700;

  /* Wording copied from closing-gifts.html and the five steps on /sharp. */
  var ORDER_STEPS = [
    ["Find your Cutco gift", "Browse and pick the gifts you love, 6 or more, mixed and matched however you like."],
    ["Place your order", "Get your price and send your request. Wilson calls to confirm your gifts and engraving and share any current deals."],
    ["Approve your proof", "Your invoice and engraving proof arrive in your inbox within a few business days."],
    ["Receive your gifts", "Your whole order arrives at once within 30 days, delivered to your office and signed for, with tracking emailed when it's on its way."],
    ["Grab, go, give", "Hand your client a gift they'll use for a lifetime. Every time they reach for it, your appreciation lasts forever."]
  ];

  var GIFT_WORDS = ["cutco", "knife", "gift", "quote", "price", "engraving"];
  var COACH_WORDS = ["coach", "coaching"];
  var SPEAK_WORDS = ["speak", "speaker", "keynote"];

  var TOPICS = {
    speaking: { subject: "Speaking enquiry", href: "/speaking.html", label: "Speaking page" },
    coaching: { subject: "Coaching enquiry", href: "/coaching.html", label: "Coaching page" },
    access: { subject: "Access to Wilson enquiry", href: "/contact.html", label: "Contact page" },
    "closing-gifts": { subject: "Closing gifts question", href: "/closing-gifts.html", label: "Closing gifts page" },
    other: { subject: "Message", href: "/contact.html", label: "Contact page" }
  };

  var root = document.createElement("div");
  root.className = "dd-chat";
  root.id = "dd-chat";
  root.innerHTML =
    '<div class="dd-backdrop" hidden></div>' +
    '<section class="dd-panel" id="dd-panel" role="dialog" aria-modal="true" aria-labelledby="dd-title" aria-describedby="dd-greeting" hidden>' +
      '<header class="dd-head">' +
        '<span class="dd-avatar" aria-hidden="true">DD</span>' +
        '<div class="dd-id"><h2 id="dd-title">Dee Dee</h2><p class="dd-role">Wilson\'s closing-gifts assistant</p></div>' +
        '<button type="button" class="dd-close" aria-label="Close chat">×</button>' +
      '</header>' +
      '<div class="dd-log" id="dd-log">' +
        '<p class="dd-bubble dd-bot" id="dd-greeting"></p>' +
        '<div class="dd-live" id="dd-live" aria-live="polite"></div>' +
      '</div>' +
      '<div class="dd-replies" id="dd-replies" role="group" aria-label="Choices"></div>' +
      '<form class="dd-form" id="dd-form" hidden novalidate>' +
        '<p class="dd-form-error" id="dd-form-error" role="alert"></p>' +
        '<label for="dd-name">Name</label>' +
        '<input id="dd-name" name="name" autocomplete="name" required>' +
        '<label for="dd-contact">Email or phone</label>' +
        '<input id="dd-contact" name="contact" autocomplete="email" inputmode="email" required>' +
        '<label for="dd-message">Message <span class="dd-optional">(optional)</span></label>' +
        '<textarea id="dd-message" name="message" rows="2"></textarea>' +
        '<input type="hidden" id="dd-topic" name="topic" value="">' +
        '<button type="submit" class="dd-primary">Send to Wilson</button>' +
      '</form>' +
      '<form class="dd-composer" id="dd-composer">' +
        '<label class="dd-sr" for="dd-input">Message Dee Dee</label>' +
        '<input id="dd-input" type="text" autocomplete="off" maxlength="600" placeholder="Type a message">' +
        '<button type="submit" class="dd-send">Send</button>' +
      '</form>' +
    '</section>' +
    '<button type="button" class="dd-launcher" id="dd-launcher" aria-expanded="false" aria-controls="dd-panel" aria-label="Open chat with Dee Dee">DD</button>';

  document.body.appendChild(root);

  var panel = document.getElementById("dd-panel");
  var launcher = document.getElementById("dd-launcher");
  var backdrop = root.querySelector(".dd-backdrop");
  var closeBtn = root.querySelector(".dd-close");
  var greeting = document.getElementById("dd-greeting");
  var live = document.getElementById("dd-live");
  var log = document.getElementById("dd-log");
  var replies = document.getElementById("dd-replies");
  var form = document.getElementById("dd-form");
  var formError = document.getElementById("dd-form-error");
  var topicInput = document.getElementById("dd-topic");
  var nameInput = document.getElementById("dd-name");
  var contactInput = document.getElementById("dd-contact");
  var messageInput = document.getElementById("dd-message");
  var composer = document.getElementById("dd-composer");
  var textInput = document.getElementById("dd-input");
  var open = false;
  var busy = false;
  var navTimer = 0;
  var lastFocus = null;
  var formTopic = "";
  var formSubject = "";

  greeting.textContent = GREETING;

  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (err) { return null; }
  }
  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (err) { /* private mode */ }
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function safePath(href) {
    if (typeof href !== "string") return "";
    if (href.charAt(0) !== "/") return "";
    if (href.charAt(1) === "/" || href.charAt(1) === "\\") return "";
    if (href.indexOf("\\") !== -1 || href.indexOf(":") !== -1) return "";
    return href;
  }

  function hasWord(text, words) {
    var i;
    for (i = 0; i < words.length; i += 1) {
      if (text.indexOf(words[i]) !== -1) return true;
    }
    return false;
  }

  function starterReplies() {
    return [
      { label: "Access to Wilson", choice: "access" },
      { label: "Public speaking", choice: "speaking" },
      { label: "Coaching", choice: "coaching" },
      { label: "Closing gifts", choice: "gifts", primary: true }
    ];
  }

  function giftReplies() {
    return [
      { label: "Build my gift quote", choice: "quote", primary: true },
      { label: "See gift packages", choice: "packages" },
      { label: "How does ordering work?", choice: "steps" },
      { label: "Ask a question", choice: "ask" }
    ];
  }

  function giftsReply() {
    return {
      text: "Closing gifts are what I help with. They suit realtors, mortgage brokers, financial advisors, and anyone who wants to thank a client. Cutco is made in the USA, backed by a Forever Guarantee, and can be engraved with your name or logo. Prices stay hidden until we know who the quote is for. Wilson Wong is an independent Cutco representative.",
      replies: giftReplies()
    };
  }

  function wilsonReply(topic) {
    var key = TOPICS[topic] ? topic : "other";
    var info = TOPICS[key];
    return {
      text: key === "other"
        ? "Leave your name and how to reach you, and I'll let Wilson know so he can get back to you."
        : WILSON_NOTE,
      form: { topic: key, subject: info.subject },
      link: { href: info.href, label: info.label, newTab: false }
    };
  }

  function ruleReply(text, choice) {
    var q = String(text || "").toLowerCase();
    if (choice === "gifts" || (!choice && hasWord(q, GIFT_WORDS))) return giftsReply();
    if (choice === "coaching" || (!choice && hasWord(q, COACH_WORDS))) return wilsonReply("coaching");
    if (choice === "speaking" || (!choice && hasWord(q, SPEAK_WORDS))) return wilsonReply("speaking");
    if (choice === "access") return wilsonReply("access");
    if (choice === "quote") {
      return {
        text: "Opening the gift quote in a new tab. Pick your gifts, see your pricing, and Wilson will call you.",
        openTab: "/sharp/",
        link: { href: "/sharp/", label: "Build your gift quote", newTab: true },
        replies: giftReplies()
      };
    }
    if (choice === "packages") {
      if (location.pathname === "/closing-gifts.html") {
        return {
          text: "You're on the closing gifts page. The packages are on this page.",
          replies: giftReplies()
        };
      }
      return { text: "Taking you to the closing gifts page.", navigate: "/closing-gifts.html" };
    }
    if (choice === "steps") {
      return { text: "What to expect", steps: ORDER_STEPS, replies: giftReplies() };
    }
    if (choice === "ask") {
      return {
        text: "Leave your name and how to reach you, and I'll let Wilson know.",
        form: { topic: "closing-gifts", subject: TOPICS["closing-gifts"].subject }
      };
    }
    return wilsonReply("other");
  }

  function asText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeReply(data) {
    var source = data || {};
    var reply = ruleReply("", "");
    reply = {
      text: asText(source.text) || reply.text,
      replies: [],
      steps: [],
      form: null,
      link: null,
      openTab: safePath(asText(source.openTab)),
      navigate: safePath(asText(source.navigate))
    };
    if (Array.isArray(source.replies)) {
      source.replies.forEach(function (item) {
        if (!item || !asText(item.label) || !asText(item.choice)) return;
        reply.replies.push({
          label: asText(item.label),
          choice: asText(item.choice),
          primary: !!item.primary
        });
      });
    }
    if (Array.isArray(source.steps)) {
      source.steps.forEach(function (pair) {
        if (!pair || !asText(pair[0]) || !asText(pair[1])) return;
        reply.steps.push([asText(pair[0]), asText(pair[1])]);
      });
    }
    if (source.form && asText(source.form.topic)) {
      reply.form = { topic: asText(source.form.topic), subject: asText(source.form.subject) || "Message" };
    }
    if (source.link && safePath(asText(source.link.href))) {
      reply.link = {
        href: safePath(asText(source.link.href)),
        label: asText(source.link.label) || "Open page",
        newTab: !!source.link.newTab
      };
    }
    return reply;
  }

  /* The only place a future assistant endpoint is called. */
  function getReply(input) {
    var text = input && input.text ? String(input.text) : "";
    var choice = input && input.choice ? String(input.choice) : "";
    if (CHAT_ENDPOINT) {
      return fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ message: text, choice: choice, page: location.pathname })
      }).then(function (response) {
        if (!response.ok) throw new Error("Chat endpoint failed");
        return response.json();
      }).then(function (data) {
        return normalizeReply(data);
      }).catch(function () {
        return ruleReply(text, choice);
      });
    }
    return Promise.resolve(ruleReply(text, choice));
  }

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  function bubble(className, text, prefix) {
    var node = document.createElement("div");
    node.className = "dd-bubble " + className;
    if (prefix) {
      var sr = document.createElement("span");
      sr.className = "dd-sr";
      sr.textContent = prefix;
      node.appendChild(sr);
    }
    node.appendChild(document.createTextNode(text));
    return node;
  }

  function pushUser(text) {
    live.appendChild(bubble("dd-user", text, "You said: "));
    scrollLog();
  }

  function setReplies(items) {
    replies.replaceChildren();
    if (!items || !items.length) {
      replies.hidden = true;
      return;
    }
    replies.hidden = false;
    items.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "dd-reply" + (item.primary ? " dd-primary" : "");
      button.textContent = item.label;
      button.setAttribute("data-choice", item.choice);
      button.addEventListener("click", function () {
        onChoice(item.choice, item.label);
      });
      replies.appendChild(button);
    });
  }

  function hideForm() {
    form.hidden = true;
    formTopic = "";
    formSubject = "";
    topicInput.value = "";
    formError.textContent = "";
  }

  function showForm(spec) {
    form.hidden = false;
    formTopic = spec.topic;
    formSubject = spec.subject || "";
    topicInput.value = spec.topic;
    formError.textContent = "";
    nameInput.removeAttribute("aria-invalid");
    contactInput.removeAttribute("aria-invalid");
  }

  function renderLink(parent, link) {
    var row = document.createElement("p");
    var anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (link.newTab) {
      anchor.target = "_blank";
      anchor.rel = "noopener";
      var sr = document.createElement("span");
      sr.className = "dd-sr";
      sr.textContent = " (opens in a new tab)";
      anchor.appendChild(sr);
    }
    row.appendChild(anchor);
    parent.appendChild(row);
  }

  function renderSteps(parent, steps) {
    var list = document.createElement("ol");
    list.className = "dd-steps";
    steps.forEach(function (pair) {
      var item = document.createElement("li");
      var title = document.createElement("strong");
      title.textContent = pair[0];
      var detail = document.createElement("span");
      detail.textContent = pair[1];
      item.append(title, detail);
      list.appendChild(item);
    });
    parent.appendChild(list);
  }

  function renderReply(reply, moveFocus) {
    hideForm();
    var node = document.createElement("div");
    node.className = "dd-bubble dd-bot";
    node.tabIndex = -1;
    var sr = document.createElement("span");
    sr.className = "dd-sr";
    sr.textContent = "Dee Dee says: ";
    var text = document.createElement("p");
    text.textContent = reply.text;
    node.append(sr, text);
    if (reply.steps && reply.steps.length) renderSteps(node, reply.steps);
    if (reply.link) renderLink(node, reply.link);
    live.appendChild(node);
    setReplies(reply.replies || []);
    if (reply.form) showForm(reply.form);
    scrollLog();
    if (moveFocus) node.focus();
    if (reply.navigate) {
      storageSet(OPEN_KEY, "0");
      var wait = reduceMotion() ? 400 : NAV_DELAY;
      window.clearTimeout(navTimer);
      navTimer = window.setTimeout(function () {
        location.assign(reply.navigate);
      }, wait);
    }
  }

  function setBusy(next) {
    busy = next;
    replies.querySelectorAll("button").forEach(function (button) { button.disabled = next; });
    textInput.disabled = next;
    composer.querySelector("button").disabled = next;
  }

  function openTab(href) {
    var path = safePath(href);
    if (!path) return;
    var link = document.createElement("a");
    link.href = path;
    link.target = "_blank";
    link.rel = "noopener";
    panel.appendChild(link);
    link.click();
    link.remove();
  }

  function runReply(input, alreadyOpened, moveFocus) {
    setBusy(true);
    getReply(input).then(function (reply) {
      if (alreadyOpened && reply) reply.openTab = "";
      if (reply && reply.openTab) openTab(reply.openTab);
      renderReply(reply, moveFocus);
    }).catch(function () {
      renderReply({
        text: "I couldn't send that just now. You can reach Wilson on the contact page.",
        link: { href: "/contact.html", label: "Contact page", newTab: false },
        replies: starterReplies()
      }, true);
    }).then(function () {
      setBusy(false);
    });
  }

  function onChoice(choice, label) {
    if (busy) return;
    window.clearTimeout(navTimer);
    pushUser(label);
    var opened = false;
    if (choice === "quote") {
      openTab("/sharp/");
      opened = true;
    }
    runReply({ text: label, choice: choice }, opened, true);
  }

  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll("a[href], button, input, textarea"), function (el) {
      if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
      if (el.closest("[hidden]")) return false;
      if (el.tabIndex < 0) return false;
      return true;
    });
  }

  function setInert(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === root) return;
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
  }

  function openPanel(fromUser) {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    panel.hidden = false;
    backdrop.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close chat with Dee Dee");
    storageSet(OPEN_KEY, "1");
    setInert(true);
    syncLift();
    if (fromUser) closeBtn.focus();
  }

  function closePanel() {
    if (!open) return;
    open = false;
    window.clearTimeout(navTimer);
    panel.hidden = true;
    backdrop.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open chat with Dee Dee");
    storageSet(OPEN_KEY, "0");
    setInert(false);
    if (lastFocus && typeof lastFocus.focus === "function") launcher.focus();
  }

  function toggle() {
    if (open) closePanel();
    else openPanel(true);
  }

  function onKey(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  function validContact(value) {
    if (value.indexOf("@") !== -1) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    var digits = value.replace(/\D/g, "");
    return digits.length >= 10;
  }

  function clearFormError() {
    formError.textContent = "";
    nameInput.removeAttribute("aria-invalid");
    contactInput.removeAttribute("aria-invalid");
  }

  nameInput.addEventListener("input", clearFormError);
  contactInput.addEventListener("input", clearFormError);

  function subjectLine(topic, name) {
    var info = TOPICS[topic] || TOPICS.other;
    var subject = formSubject || info.subject;
    var clean = name.replace(/[\r\n]+/g, " ").trim().slice(0, 80);
    return "Website chat: " + subject + " from " + clean;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    var name = nameInput.value.trim();
    var contact = contactInput.value.trim();
    var message = messageInput.value.trim();
    var topic = formTopic || topicInput.value || "other";
    nameInput.removeAttribute("aria-invalid");
    contactInput.removeAttribute("aria-invalid");
    if (!name) {
      nameInput.setAttribute("aria-invalid", "true");
      formError.textContent = "Add your name.";
      nameInput.focus();
      return;
    }
    if (!validContact(contact)) {
      contactInput.setAttribute("aria-invalid", "true");
      formError.textContent = "Add an email or a phone number.";
      contactInput.focus();
      return;
    }
    var payload = {
      _subject: subjectLine(topic, name),
      _template: "table",
      _captcha: false,
      topic: topic,
      Name: name,
      "Email or phone": contact,
      Message: message,
      Page: location.pathname
    };
    if (contact.indexOf("@") !== -1) payload._replyto = contact;
    var submitBtn = form.querySelector("button");
    submitBtn.disabled = true;
    formError.textContent = "Sending…";
    fetch(FORMSUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("Request failed");
      hideForm();
      form.reset();
      renderReply({ text: "Thanks! I've let Wilson know.", replies: starterReplies() }, true);
    }).catch(function () {
      formError.textContent = "That did not send. Call or text Wilson at 780-915-0982, or email executive.wilsonwong@gmail.com.";
    }).then(function () {
      submitBtn.disabled = false;
    });
  });

  composer.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    var text = textInput.value.trim();
    if (!text) return;
    textInput.value = "";
    window.clearTimeout(navTimer);
    pushUser(text);
    runReply({ text: text, choice: "" }, false, false);
  });

  launcher.addEventListener("click", toggle);
  closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", onKey);

  function barTopGap(el) {
    if (!el || !el.getClientRects().length) return 0;
    var style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    var rect = el.getBoundingClientRect();
    if (rect.bottom < window.innerHeight - 220) return 0;
    return Math.max(0, Math.round(window.innerHeight - rect.top));
  }

  function syncLift() {
    var gap = 0;
    gap = Math.max(gap, barTopGap(document.getElementById("gift-sticky")));
    gap = Math.max(gap, barTopGap(document.querySelector("a.fab")));
    if (document.body.classList.contains("browsing")) {
      gap = Math.max(gap, barTopGap(document.getElementById("tray")));
    }
    var lift = gap > 0 ? gap + 12 : 0;
    if (lift) root.style.bottom = lift + "px";
    else root.style.bottom = "";
    var reserve = (lift || 16) + 88;
    root.style.setProperty("--dd-max", "calc(100dvh - " + reserve + "px)");
    var width = Math.max(240, Math.min(360, document.documentElement.clientWidth - 32));
    panel.style.width = width + "px";
  }

  var liftObserver = new MutationObserver(syncLift);
  liftObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  var sticky = document.getElementById("gift-sticky");
  if (sticky) liftObserver.observe(sticky, { attributes: true, attributeFilter: ["class"] });
  var fab = document.querySelector("a.fab");
  if (fab) liftObserver.observe(fab, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", syncLift);
  syncLift();

  setReplies(starterReplies());

  if (!storageGet(NUDGE_KEY)) {
    storageSet(NUDGE_KEY, "1");
    if (!reduceMotion()) launcher.classList.add("is-nudging");
  }

  if (storageGet(OPEN_KEY) === "1") openPanel(false);
})();
