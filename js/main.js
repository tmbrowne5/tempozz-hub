(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function setupNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector("#site-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
  }

  function setupSearch(options) {
    var root = options.root;
    if (!root) return;
    var input = options.input;
    var filter = "all";

    function blobFor(entry) {
      var block = entry.closest("[data-bot]") || root;
      var head = block.querySelector("h3");
      var group = entry.closest(".group");
      var groupHead = group ? group.querySelector("h4") : null;
      var groupLabel = groupHead ? groupHead.textContent : "";
      var parts = [
        block.getAttribute("data-bot") || "",
        block.getAttribute("data-keywords") || "",
        head ? head.textContent : "",
        groupLabel,
        entry.textContent
      ];
      return parts.join(" ").toLowerCase().replace(/\s+/g, " ");
    }

    function apply() {
      var q = input ? input.value.trim().toLowerCase().replace(/\s+/g, " ") : "";
      var blocks = root.querySelectorAll("[data-bot]");
      var shown = 0;
      var any = false;

      blocks.forEach(function (block) {
        var bot = block.getAttribute("data-bot") || "";
        var botOk = filter === "all" || bot === filter;
        block.querySelectorAll(".entry").forEach(function (entry) {
          var hit = botOk && blobFor(entry).indexOf(q) !== -1;
          entry.hidden = !hit;
          if (hit) {
            any = true;
            shown += 1;
          }
        });
        block.querySelectorAll(".group").forEach(function (group) {
          var groupHit = Array.prototype.some.call(group.querySelectorAll(".entry"), function (entry) {
            return !entry.hidden;
          });
          group.hidden = !groupHit;
        });
        var blockHit = Array.prototype.some.call(block.querySelectorAll(".entry"), function (entry) {
          return !entry.hidden;
        });
        block.hidden = !blockHit;
      });

      if (options.details) syncDetails(q);

      if (options.empty) options.empty.hidden = any;
      if (options.count) {
        var noun = shown === 1 ? "command" : "commands";
        options.count.textContent = shown + " " + noun;
      }
    }

    function syncDetails(q) {
      root.querySelectorAll("details").forEach(function (panel) {
        var has = Array.prototype.some.call(panel.querySelectorAll(".entry"), function (entry) {
          return !entry.hidden;
        });
        if (q && has) {
          if (!panel.open) {
            panel.open = true;
            panel.dataset.searchOpened = "1";
          }
        } else if (panel.dataset.searchOpened === "1" && (!q || !has)) {
          panel.open = false;
          delete panel.dataset.searchOpened;
        }
      });
    }

    if (input) input.addEventListener("input", apply);

    if (options.filters) {
      options.filters.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-filter]");
        if (!button || !options.filters.contains(button)) return;
        filter = button.getAttribute("data-filter") || "all";
        options.filters.querySelectorAll("button[data-filter]").forEach(function (chip) {
          var on = chip === button;
          chip.classList.toggle("is-on", on);
          chip.setAttribute("aria-pressed", on ? "true" : "false");
        });
        apply();
      });
    }

    apply();
  }

  function setupBotToggle() {
    var button = document.querySelector("#toggle-bots");
    var root = document.querySelector("#bot-root");
    if (!button || !root) return;

    button.addEventListener("click", function () {
      var panels = root.querySelectorAll("details");
      var openThem = Array.prototype.some.call(panels, function (panel) {
        return !panel.open;
      });
      panels.forEach(function (panel) {
        panel.open = openThem;
        if (openThem) delete panel.dataset.searchOpened;
      });
      button.textContent = openThem ? "Close all" : "Open all";
    });
  }

  function setupLogoFallback() {
    document.querySelectorAll("img[data-fallback]").forEach(function (img) {
      function fail() {
        img.classList.add("is-broken");
      }
      img.addEventListener("error", fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function setupCurrentNav() {
    if (!("IntersectionObserver" in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('#site-nav a[href^="#"]'));
    var pairs = links.map(function (link) {
      var id = link.getAttribute("href").slice(1);
      return [document.getElementById(id), link];
    }).filter(function (pair) {
      return pair[0];
    });
    if (!pairs.length) return;
    var byEl = new Map(pairs);
    var obs = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) {
        return entry.isIntersecting;
      });
      if (!visible.length) return;
      visible.sort(function (a, b) {
        return b.intersectionRatio - a.intersectionRatio;
      });
      links.forEach(function (link) {
        link.removeAttribute("aria-current");
      });
      var current = byEl.get(visible[0].target);
      if (current) current.setAttribute("aria-current", "true");
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] });
    pairs.forEach(function (pair) {
      obs.observe(pair[0]);
    });
  }

  ready(function () {
    setupNav();
    setupSearch({
      input: document.querySelector("#cmd-search"),
      root: document.querySelector("#cmd-root"),
      empty: document.querySelector("#cmd-empty"),
      count: document.querySelector("#cmd-count"),
      filters: document.querySelector("#cmd-filters")
    });
    setupSearch({
      input: document.querySelector("#bot-search"),
      root: document.querySelector("#bot-root"),
      empty: document.querySelector("#bot-empty"),
      count: document.querySelector("#bot-count"),
      details: true
    });
    setupBotToggle();
    setupLogoFallback();
    setupCurrentNav();
  });
})();
