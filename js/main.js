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

  function setupLeaderboard() {
    var list = document.querySelector("#lb-list");
    var status = document.querySelector("#lb-status");
    var fallback = document.querySelector("#lb-fallback");
    if (!list || !status || !fallback) return;

    var channel = "tempozz";
    var limit = 10;
    var refreshMs = 2 * 60 * 1000;
    var channelId = "";
    var hasRows = false;
    var pending = false;

    function setStatus(text) {
      status.textContent = text;
      status.hidden = !text;
    }

    function showFallback() {
      if (hasRows) {
        setStatus("Still showing the last scores. The newest pull didn't land.");
        return;
      }
      list.hidden = true;
      fallback.hidden = false;
      setStatus("");
    }

    function formatPoints(value) {
      return value.toLocaleString("en-US");
    }

    function readUsers(payload) {
      if (!payload || !Array.isArray(payload.users)) return [];
      var rows = [];
      payload.users.forEach(function (user) {
        if (!user || typeof user.username !== "string") return;
        var name = user.username.trim();
        var points = Number(user.points);
        if (!name || !Number.isFinite(points)) return;
        rows.push({ username: name, points: points });
      });
      return rows.slice(0, limit);
    }

    function render(users) {
      var fragment = document.createDocumentFragment();
      users.forEach(function (user, index) {
        var rank = index + 1;
        var row = document.createElement("li");
        row.className = "lb-row";
        if (rank === 1) row.classList.add("lb-gold");
        else if (rank === 2) row.classList.add("lb-silver");
        else if (rank === 3) row.classList.add("lb-bronze");

        var badge = document.createElement("span");
        badge.className = "lb-rank";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = String(rank);

        var name = document.createElement("span");
        name.className = "lb-name";
        name.textContent = user.username;

        var points = document.createElement("span");
        points.className = "lb-points";
        var amount = document.createElement("span");
        amount.className = "lb-amount";
        amount.textContent = formatPoints(user.points);
        var unit = document.createElement("span");
        unit.className = "lb-unit";
        unit.textContent = "Temp Coins";
        points.appendChild(amount);
        points.appendChild(unit);

        row.appendChild(badge);
        row.appendChild(name);
        row.appendChild(points);
        fragment.appendChild(row);
      });

      list.replaceChildren(fragment);
      list.hidden = false;
      fallback.hidden = true;
      hasRows = true;
      var stamp = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      setStatus("Updated " + stamp + ". Refreshes every couple of minutes.");
    }

    function fetchJson(url) {
      return fetch(url, { cache: "no-store", headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      });
    }

    function load() {
      if (pending) return;
      pending = true;

      var idReady = channelId
        ? Promise.resolve(channelId)
        : fetchJson("https://api.streamelements.com/kappa/v2/channels/" + encodeURIComponent(channel)).then(function (data) {
          if (!data || typeof data._id !== "string" || !data._id) throw new Error("no id");
          channelId = data._id;
          return channelId;
        });

      idReady.then(function (id) {
        return fetchJson("https://api.streamelements.com/kappa/v2/points/" + encodeURIComponent(id) + "/top?limit=" + limit);
      }).then(function (data) {
        var users = readUsers(data);
        if (!users.length) throw new Error("empty");
        render(users);
      }).catch(function () {
        showFallback();
      }).then(function () {
        pending = false;
      });
    }

    load();
    setInterval(load, refreshMs);
  }

  ready(function () {
    setupNav();
    setupLeaderboard();
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
