/* Shared site behavior: copy-to-clipboard and the search shortcut. */
(function () {
  "use strict";

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    var initial = button.textContent;
    button.addEventListener("click", function () {
      copyText(button.getAttribute("data-copy") || "").then(
        function () {
          button.textContent = "Copied";
          button.classList.add("is-copied");
          window.setTimeout(function () {
            button.textContent = initial;
            button.classList.remove("is-copied");
          }, 1600);
        },
        function () {
          button.textContent = "Press Ctrl+C";
          window.setTimeout(function () {
            button.textContent = initial;
          }, 1600);
        }
      );
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    var target = event.target;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable)) return;
    var search = document.getElementById("key-search");
    if (search) {
      event.preventDefault();
      search.focus();
      search.select();
    }
  });
})();
