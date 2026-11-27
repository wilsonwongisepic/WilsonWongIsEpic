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
