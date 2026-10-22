/* Schema explorer: client-side search/filter with URL state.
   The key list is rendered server-side from the canonical schema; this
   script only filters existing DOM nodes, so the page is fully readable
   without JavaScript. */
(function () {
  "use strict";

  var root = document.querySelector("[data-explorer]");
  if (!root) return;

  var cards = Array.prototype.slice.call(root.querySelectorAll(".key-card"));
  var search = document.getElementById("key-search");
  var typeFilter = document.getElementById("type-filter");
  var editFilter = document.getElementById("edit-filter");
  var chips = Array.prototype.slice.call(root.querySelectorAll(".cat-chip"));
  var resultCount = root.querySelector("[data-result-count]");
  var resultLabel = root.querySelector("[data-result-label]");
  var empty = root.querySelector("[data-empty]");
  var resets = Array.prototype.slice.call(root.querySelectorAll("[data-reset]"));

  var state = { q: "", cat: "", type: "", edit: "", key: "" };
  var timer = null;

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    state.cat = params.get("cat") || "";
    state.type = params.get("type") || "";
    state.edit = params.get("edit") || "";
    state.key = params.get("key") || "";
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.cat) params.set("cat", state.cat);
    if (state.type) params.set("type", state.type);
    if (state.edit) params.set("edit", state.edit);
    if (state.key) params.set("key", state.key);
    var query = params.toString();
    var next = window.location.pathname + (query ? "?" + query : "");
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }

  function escapeAttr(value) {
    return String(value).replace(/"/g, '\"');
  }

  function findCard(value) {
    if (!value) return null;
    return root.querySelector('[data-slug="' + escapeAttr(value) + '"]') ||
      root.querySelector('[data-key="' + escapeAttr(value) + '"]');
  }

  function cardMatches(card) {
    if (state.cat && card.getAttribute("data-cat") !== state.cat) return false;
    if (state.type && card.getAttribute("data-type") !== state.type) return false;
    if (state.edit) {
      if (state.edit === "editable" && card.getAttribute("data-editable") !== "editable") return false;
      if (state.edit === "readonly" && card.getAttribute("data-editable") !== "readonly") return false;
      if (state.edit === "specialized" && card.getAttribute("data-specialized") !== "yes") return false;
    }
    if (state.q) {
      var haystack = (card.getAttribute("data-search") || "").toLowerCase();
      var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) {
        if (haystack.indexOf(terms[i]) === -1) return false;
      }
    }
    return true;
  }

  function apply(opts) {
    opts = opts || {};
    var visible = 0;
    cards.forEach(function (card) {
      var show = cardMatches(card);
      card.hidden = !show;
      if (show) visible++;
    });
    if (resultCount) resultCount.textContent = String(visible);
    if (resultLabel) resultLabel.textContent = visible === 1 ? "key" : "keys";
    if (empty) empty.hidden = visible !== 0;

    chips.forEach(function (chip) {
      var active = (chip.getAttribute("data-cat") || "") === state.cat;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (typeFilter) typeFilter.value = state.type;
    if (editFilter) editFilter.value = state.edit;
    if (search && search.value !== state.q) search.value = state.q;

    if (state.key && !opts.silent) {
      var card = findCard(state.key);
      if (card) {
        var details = card.querySelector(".key-details");
        if (details) details.open = true;
        card.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
  }

  function update(patch) {
    Object.keys(patch).forEach(function (key) { state[key] = patch[key]; });
    writeUrl();
    apply();
  }

  if (search) {
    search.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        update({ q: search.value.trim(), key: "" });
      }, 90);
    });
    search.addEventListener("search", function () {
      if (search.value === "") update({ q: "", key: "" });
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", function () { update({ type: typeFilter.value, key: "" }); });
  }
  if (editFilter) {
    editFilter.addEventListener("change", function () { update({ edit: editFilter.value, key: "" }); });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      update({ cat: chip.getAttribute("data-cat") || "", key: "" });
    });
  });

  resets.forEach(function (button) {
    button.addEventListener("click", function () {
      update({ q: "", cat: "", type: "", edit: "", key: "" });
      if (search) search.focus();
    });
  });

  root.addEventListener("click", function (event) {
    var link = event.target.closest("[data-key-link]");
    if (!link) return;
    event.preventDefault();
    var card = link.closest(".key-card");
    var slug = card ? card.getAttribute("data-slug") : "";
    var details = card ? card.querySelector(".key-details") : null;
    if (details && !details.open) details.open = true;
    state.key = slug;
    writeUrl();
    if (card) card.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  readUrl();

  /* A deep-linked key wins over stale filters that would hide it. */
  if (state.key) {
    var target = findCard(state.key);
    if (target) {
      state.key = target.getAttribute("data-slug") || state.key;
      var page = target.getAttribute("data-cat") || "";
      if (state.cat && state.cat !== page) state.cat = "";
      if (state.q) state.q = "";
      if (state.type && target.getAttribute("data-type") !== state.type) state.type = "";
      if (state.edit) state.edit = "";
      writeUrl();
    }
  }

  apply({ silent: !state.key });
})();
