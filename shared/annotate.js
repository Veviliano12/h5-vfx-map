(function (global) {
  var NAME_KEY = "h5-vfx-annotator-name";
  var LOCAL_KEY = "h5-vfx-annotations-v1";
  var cfg = global.VFX_NOTES_CONFIG || {};
  var state = { items: {}, updatedAt: null };
  var saving = false;
  var timer = null;

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  }
  function now() { return new Date().toISOString(); }
  function getName() { return (localStorage.getItem(NAME_KEY) || "").trim(); }
  function setName(n) {
    n = (n || "").trim();
    if (n) localStorage.setItem(NAME_KEY, n);
    else localStorage.removeItem(NAME_KEY);
    return n;
  }
  function needName() {
    var el = document.getElementById("anno-name");
    var typed = el ? (el.value || "").trim() : "";
    var n = getName() || typed;
    if (n) {
      setName(n);
      if (el) { el.value = n; el.classList.remove("need"); }
      return n;
    }
    if (el) { el.classList.add("need"); el.focus(); }
    setSync("请先在右上角写署名，再做标记", "err");
    return "";
  }
  function setSync(text, cls) {
    var el = document.getElementById("anno-sync");
    if (!el) return;
    el.textContent = text;
    el.className = "live-sync" + (cls ? " " + cls : "");
  }
  function item(id) {
    if (!state.items[id]) state.items[id] = { marks: {}, notes: [] };
    if (!state.items[id].marks) state.items[id].marks = {};
    if (!state.items[id].notes) state.items[id].notes = [];
    return state.items[id];
  }
  function later(a, b) { return (!a || (b && b > a)) ? b : a; }
  function mergeRemote(remote) {
    if (!remote || !remote.items) return;
    Object.keys(remote.items).forEach(function (id) {
      var r = remote.items[id] || {};
      var l = item(id);
      var rm = r.marks || {};
      Object.keys(rm).forEach(function (author) {
        var rv = rm[author], lv = l.marks[author];
        if (!lv || (rv && rv.at && (!lv.at || rv.at > lv.at))) l.marks[author] = rv;
      });
      var notes = (l.notes || []).slice();
      var seen = {};
      notes.forEach(function (n) { if (n && n.id) seen[n.id] = true; });
      (r.notes || []).forEach(function (n) {
        if (n && n.id && !seen[n.id]) { notes.push(n); seen[n.id] = true; }
      });
      notes.sort(function (a, b) { return (a.at || "") < (b.at || "") ? -1 : 1; });
      l.notes = notes;
    });
    state.updatedAt = later(state.updatedAt, remote.updatedAt);
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (raw) mergeRemote(JSON.parse(raw));
    } catch (e) {}
  }
  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function snapshot() {
    return { items: state.items, updatedAt: state.updatedAt || now() };
  }

  function pull() {
    if (!cfg.url) return Promise.resolve();
    return fetch(cfg.url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("读取批注失败");
      return res.json();
    }).then(function (data) {
      mergeRemote(data);
      saveLocal();
    });
  }
  function push() {
    saveLocal();
    if (!cfg.url) {
      setSync("已记在这台电脑上", "");
      return Promise.resolve();
    }
    if (saving) return Promise.resolve();
    saving = true;
    state.updatedAt = now();
    return fetch(cfg.url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(snapshot())
    }).then(function (res) {
      if (!res.ok) throw new Error("同步失败");
      setSync("已同步，同事刷新或稍等即可看到", "ok");
    }).catch(function (err) {
      setSync(err.message || "同步失败，已先保存在这台电脑", "err");
    }).then(function () { saving = false; });
  }

  function summary(id) {
    var it = item(id);
    var seen = [];
    var suit = [];
    var unsuit = [];
    Object.keys(it.marks).forEach(function (author) {
      var m = it.marks[author] || {};
      if (m.seen) seen.push(author);
      if (m.verdict === "suitable") suit.push(author);
      if (m.verdict === "unsuitable") unsuit.push(author);
    });
    return { seen: seen, suit: suit, unsuit: unsuit, notes: it.notes || [] };
  }
  function badgeHTML(id) {
    var s = summary(id);
    var bits = [];
    if (s.suit.length) bits.push('<span class="suit">合适 ' + s.suit.length + "</span>");
    if (s.unsuit.length) bits.push('<span class="unsuit">不合适 ' + s.unsuit.length + "</span>");
    if (s.seen.length && !s.suit.length && !s.unsuit.length) bits.push("<span>看过了 " + s.seen.length + "</span>");
    if (!bits.length) return "";
    return '<div class="anno-badge">' + bits.join("") + "</div>";
  }
  function decorate(root) {
    (root || document).querySelectorAll("[data-id]").forEach(function (el) {
      var id = el.getAttribute("data-id");
      if (!id) return;
      var old = el.querySelector(":scope > .anno-badge, :scope > .pic + .anno-badge");
      // remove previous badges we added
      el.querySelectorAll(".anno-badge").forEach(function (b) { b.remove(); });
      var html = badgeHTML(id);
      if (!html) return;
      var wrap = el.querySelector(".pic, .thumb") || el;
      wrap.insertAdjacentHTML("afterbegin", html);
    });
  }

  function marksLine(id) {
    var s = summary(id);
    var parts = [];
    if (s.seen.length) parts.push("看过了：" + s.seen.join("、"));
    if (s.suit.length) parts.push("合适：" + s.suit.join("、"));
    if (s.unsuit.length) parts.push("不合适：" + s.unsuit.join("、"));
    return parts.length ? '<p class="anno-marks">' + esc(parts.join("  ·  ")) + "</p>" : '<p class="anno-marks">还没有人标记</p>';
  }
  function threadHTML(id) {
    var notes = item(id).notes || [];
    if (!notes.length) return "";
    return '<ul class="anno-thread">' + notes.map(function (n) {
      var when = "";
      if (n.at) {
        try {
          when = new Date(n.at).toLocaleString("zh-CN", { hour12: false, timeZone: "America/New_York" }) + " ET";
        } catch (e) { when = n.at; }
      }
      return "<li><span class=\"who\">" + esc(n.author || "未署名") + "</span>" +
        (when ? '<span class="when">' + esc(when) + "</span>" : "") +
        "<div>" + esc(n.text) + "</div></li>";
    }).join("") + "</ul>";
  }
  function panelHTML(id, compact) {
    var name = getName();
    var mine = (item(id).marks[name] || {});
    return '<div class="anno-panel' + (compact ? " compact" : "") + '" data-anno-id="' + esc(id) + '">' +
      "<h3>协作批注</h3>" +
      marksLine(id) +
      '<div class="anno-btns">' +
        '<button type="button" data-anno="seen"' + (mine.seen ? ' class="on-seen"' : "") + ">看过了</button>" +
        '<button type="button" data-anno="suitable"' + (mine.verdict === "suitable" ? ' class="on-suit"' : "") + ">合适</button>" +
        '<button type="button" data-anno="unsuitable"' + (mine.verdict === "unsuitable" ? ' class="on-unsuit"' : "") + ">不合适</button>" +
      "</div>" +
      '<p class="anno-hint">点「看过了」会立刻记下，写了字请再点「保存批注」。没有单独的保存按钮。</p>' +
      '<textarea data-anno-text placeholder="写一句批注，点「保存批注」即可记下"></textarea>' +
      '<button type="button" class="anno-add" data-anno="note">保存批注</button>' +
      threadHTML(id) +
    "</div>";
  }
  function mountPanel(host, id, compact) {
    if (!host) return;
    var old = host.querySelector(':scope > .anno-panel, .anno-panel[data-anno-id="' + id + '"]');
    if (old) old.remove();
    host.insertAdjacentHTML("beforeend", panelHTML(id, compact));
    bindPanel(host, id);
  }
  function bindPanel(root, id) {
    var panel = root.querySelector('.anno-panel[data-anno-id="' + id + '"]');
    if (!panel) return;
    panel.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-anno]");
      if (!btn) return;
      var name = needName();
      if (!name) return;
      var act = btn.getAttribute("data-anno");
      var it = item(id);
      if (act === "note") {
        var ta = panel.querySelector("[data-anno-text]");
        var text = ta ? ta.value.trim() : "";
        if (!text) { if (ta) ta.focus(); return; }
        it.notes.push({ id: name + "-" + Date.now(), author: name, text: text, at: now() });
        if (ta) ta.value = "";
      } else if (act === "seen") {
        var cur = it.marks[name] || {};
        it.marks[name] = { seen: !cur.seen, verdict: cur.verdict || "", at: now() };
      } else {
        var cur2 = it.marks[name] || {};
        var next = cur2.verdict === act ? "" : act;
        it.marks[name] = { seen: true, verdict: next, at: now() };
      }
      push();
      refreshUI();
      // remount this panel to refresh buttons/thread
      var parent = panel.parentNode;
      mountPanel(parent, id, panel.classList.contains("compact"));
    });
  }

  function refreshPanels(root) {
    (root || document).querySelectorAll(".anno-panel[data-anno-id]").forEach(function (panel) {
      var id = panel.getAttribute("data-anno-id");
      var parent = panel.parentNode;
      if (id && parent) mountPanel(parent, id, panel.classList.contains("compact"));
    });
  }
  function refreshUI() {
    decorate(document);
    refreshPanels(document);
  }

  function mountHeader() {
    var input = document.getElementById("anno-name");
    if (input) {
      input.value = getName();
      function saveName() {
        setName(input.value);
        input.classList.remove("need");
        setSync(getName() ? "署名已记下" : "请先写署名", getName() ? "ok" : "");
      }
      input.addEventListener("change", saveName);
      input.addEventListener("blur", saveName);
    }
    if (!cfg.url) setSync("已记在这台电脑，不用另点保存。共享同步尚未接通", "");
    else setSync("批注会同步给同事", "");
  }

  function start() {
    loadLocal();
    mountHeader();
    pull().then(function () {
      decorate(document);
      refreshPanels(document);
      if (cfg.url) setSync("已拉取同事的标记", "ok");
    }).catch(function () {
      decorate(document);
      refreshPanels(document);
      if (cfg.url) setSync("暂时读不到共享批注，先用本机记录", "err");
    });
    if (timer) clearInterval(timer);
    var ms = cfg.pollMs || 12000;
    timer = setInterval(function () {
      if (!cfg.url) return;
      pull().then(function () { decorate(document); }).catch(function () {});
    }, ms);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && cfg.url) {
        pull().then(function () { decorate(document); }).catch(function () {});
      }
    });
  }

  global.VFXAnnotate = {
    start: start,
    decorate: decorate,
    mountPanel: mountPanel,
    refreshPanels: refreshPanels,
    getName: getName,
    item: item,
    summary: summary
  };
  // Load stored marks immediately, before later page scripts render cards.
  // Otherwise the first paint of the panels can look empty even when local data exists.
  loadLocal();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
