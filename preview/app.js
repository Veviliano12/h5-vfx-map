(function () {
  "use strict";
  var data = window.STAGED_ABSORB;
  if (!data) {
    document.body.innerHTML = "<p style='padding:24px'>未载入数据。请用浏览器直接打开本目录中的 index.html。</p>";
    return;
  }

  var items = data.items.slice();
  var held = data.held.slice();
  var langOrder = data.languageOrder;
  var groupOrder = data.groupOrder;
  var filters = { language: [], group: [], scale: [], scene: [], q: "" };

  function unique(keyFn) {
    var seen = {};
    var out = [];
    items.forEach(function (it) {
      var vals = keyFn(it);
      (Array.isArray(vals) ? vals : [vals]).forEach(function (v) {
        if (!v || seen[v]) return;
        seen[v] = true;
        out.push(v);
      });
    });
    return out;
  }

  var allScales = unique(function (it) { return it.scale; });
  var allScenes = unique(function (it) { return it.scenes || []; });
  // stable preferred scene order if present
  var scenePref = ["落地页", "互动体验与游戏", "教育与展览", "创作工具", "店铺与购买", "海报", "界面"];
  allScenes.sort(function (a, b) {
    var ia = scenePref.indexOf(a), ib = scenePref.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "zh");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  function countBy(fn) {
    var c = {};
    items.forEach(function (it) {
      var vals = fn(it);
      (Array.isArray(vals) ? vals : [vals]).forEach(function (v) {
        if (!v) return;
        c[v] = (c[v] || 0) + 1;
      });
    });
    return c;
  }
  var langCounts = countBy(function (it) { return it.language; });
  var groupCounts = countBy(function (it) { return it.sourceGroup; });
  var scaleCounts = countBy(function (it) { return it.scale; });
  var sceneCounts = countBy(function (it) { return it.scenes; });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matches(it) {
    if (filters.language.length && filters.language.indexOf(it.language) === -1) return false;
    if (filters.group.length && filters.group.indexOf(it.sourceGroup) === -1) return false;
    if (filters.scale.length && filters.scale.indexOf(it.scale) === -1) return false;
    if (filters.scene.length) {
      var hit = (it.scenes || []).some(function (s) { return filters.scene.indexOf(s) !== -1; });
      if (!hit) return false;
    }
    if (filters.q) {
      var q = filters.q.toLowerCase();
      var blob = [it.name, it.officialName, it.sourceGroup, it.sourceSite, it.reason, it.url, it.language, (it.scenes || []).join(" ")].join(" ").toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }

  function chip(group, value, label, n) {
    var on = filters[group].indexOf(value) !== -1;
    return '<button type="button" class="chip" data-group="' + esc(group) + '" data-value="' + esc(value) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
      esc(label) + (n != null ? '<span class="n">' + n + "</span>" : "") + "</button>";
  }

  function renderFilters() {
    var host = document.getElementById("filters");
    var langChips = chip("language", "", "全部", items.length) +
      langOrder.map(function (l) { return chip("language", l, l, langCounts[l] || 0); }).join("");
    // "全部" is special: empty value means clear. Handle separately — don't include 全部 as a value in filters.language
    langChips = '<button type="button" class="chip" data-group="language" data-value="" aria-pressed="' + (filters.language.length === 0 ? "true" : "false") + '">全部<span class="n">' + items.length + "</span></button>" +
      langOrder.map(function (l) { return chip("language", l, l, langCounts[l] || 0); }).join("");

    var groupChips = '<button type="button" class="chip" data-group="group" data-value="" aria-pressed="' + (filters.group.length === 0 ? "true" : "false") + '">全部</button>' +
      groupOrder.map(function (g) { return chip("group", g, g, groupCounts[g] || 0); }).join("");
    var scaleChips = '<button type="button" class="chip" data-group="scale" data-value="" aria-pressed="' + (filters.scale.length === 0 ? "true" : "false") + '">全部</button>' +
      allScales.map(function (s) { return chip("scale", s, s, scaleCounts[s] || 0); }).join("");
    var sceneChips = '<button type="button" class="chip" data-group="scene" data-value="" aria-pressed="' + (filters.scene.length === 0 ? "true" : "false") + '">全部</button>' +
      allScenes.map(function (s) { return chip("scene", s, s, sceneCounts[s] || 0); }).join("");

    host.innerHTML =
      '<div class="wrap">' +
        '<div class="filter-row"><div class="filter-label">视效语言</div><div class="chips">' + langChips + "</div></div>" +
        '<div class="filter-row"><div class="filter-label">来源分组</div><div class="chips">' + groupChips + "</div>" +
          '<div class="search"><input type="search" id="q" placeholder="搜索名称、来源或理由" value="' + esc(filters.q) + '"></div>' +
          '<button type="button" class="reset-btn" id="reset">清除筛选</button>' +
        "</div>" +
        '<div class="filter-row"><div class="filter-label">尺度</div><div class="chips">' + scaleChips + "</div></div>" +
        '<div class="filter-row"><div class="filter-label">场景</div><div class="chips">' + sceneChips + "</div></div>" +
        '<div class="status-line" id="status"></div>' +
      "</div>";
  }

  function cardHTML(it, idx) {
    var srcLabel = it.sourceSite && it.sourceSite !== it.sourceGroup
      ? esc(it.sourceGroup) + " · " + esc(it.sourceSite)
      : esc(it.sourceGroup);
    var tags = "";
    if (it.language) tags += '<span class="tag lang">' + esc(it.language) + "</span>";
    if (it.scale) tags += '<span class="tag">' + esc(it.scale) + "</span>";
    (it.scenes || []).forEach(function (s) { tags += '<span class="tag">' + esc(s) + "</span>"; });
    var official = it.officialName ? '<span class="official">' + esc(it.officialName) + "</span>" : "";
    var img = it.thumb && !it.thumbMissing
      ? '<button type="button" class="thumb" data-idx="' + idx + '" aria-label="放大预览 ' + esc(it.name) + '"><img src="' + esc(it.thumb) + '" alt="' + esc(it.name) + ' 截图" loading="lazy"></button>'
      : '<div class="thumb thumb-missing">暂无截图</div>';
    var link = it.url
      ? '<a class="ext" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">打开原页</a>'
      : "";
    return '<article class="card" data-id="' + esc(it.id) + '">' +
      img +
      '<div class="card-body">' +
        "<h3 class=\"card-title\">" + esc(it.name) + official + "</h3>" +
        '<div class="tags">' + tags + "</div>" +
        '<p class="reason">' + esc(it.reason) + "</p>" +
        '<div class="card-actions"><span class="source">' + srcLabel + "</span>" + link + "</div>" +
        '<div class="anno-host"></div>' +
      "</div></article>";
  }

  var visibleForLightbox = [];

  function renderGallery() {
    var host = document.getElementById("gallery");
    var shown = items.filter(matches);
    visibleForLightbox = shown.slice();
    var status = document.getElementById("status");
    if (status) {
      var total = items.length;
      status.textContent = shown.length === total
        ? "正在显示已确认建议吸收 " + total + " 条。"
        : "正在显示 " + shown.length + " / " + total + " 条已确认建议吸收。";
    }
    if (!shown.length) {
      host.innerHTML = '<div class="empty">没有符合当前筛选的条目。可以清除筛选后再看。</div>';
      return;
    }
    var html = "";
    langOrder.forEach(function (lang) {
      var group = shown.filter(function (it) { return it.language === lang; });
      if (!group.length) return;
      html += '<section class="lang-section" id="lang-' + esc(lang) + '">';
      html += "<h2>" + esc(lang) + '<span class="n">' + group.length + "</span></h2>";
      html += '<div class="grid">';
      group.forEach(function (it) { html += cardHTML(it, visibleForLightbox.indexOf(it)); });
      html += "</div></section>";
    });
    // any unknown language
    var other = shown.filter(function (it) { return langOrder.indexOf(it.language) === -1; });
    if (other.length) {
      html += '<section class="lang-section"><h2>其他<span class="n">' + other.length + "</span></h2><div class=\"grid\">";
      other.forEach(function (it) { html += cardHTML(it, visibleForLightbox.indexOf(it)); });
      html += "</div></section>";
    }
    host.innerHTML = html;
    if (window.VFXAnnotate) {
      window.VFXAnnotate.decorate(host);
      host.querySelectorAll("article.card[data-id]").forEach(function (card) {
        var slot = card.querySelector(".anno-host");
        if (slot) window.VFXAnnotate.mountPanel(slot, card.getAttribute("data-id"), true);
      });
    }
  }

  function renderHeld() {
    var host = document.getElementById("held");
    if (!held.length) { host.hidden = true; return; }
    var cards = held.map(function (it, i) {
      return cardHTML(it, "h" + i);
    }).join("");
    host.innerHTML =
      "<h2>先按下，想听你判断</h2>" +
      '<p class="held-lead">' + esc((data.notes && (data.notes.rescreen || data.notes.photon)) || "") +
      " 这些不和上面已确认的 100 条主列表混在一起计。</p>" +
      '<div class="grid">' + cards + "</div>";
    host.hidden = false;
    if (window.VFXAnnotate) {
      window.VFXAnnotate.decorate(host);
      host.querySelectorAll("article.card[data-id]").forEach(function (card) {
        var slot = card.querySelector(".anno-host");
        if (slot) window.VFXAnnotate.mountPanel(slot, card.getAttribute("data-id"), true);
      });
    }
    // held lightbox is independent — use data-idx = "h0"
  }

  function toggleFilter(group, value) {
    if (!value) {
      filters[group] = [];
      return;
    }
    var arr = filters[group];
    var i = arr.indexOf(value);
    if (i === -1) arr.push(value);
    else arr.splice(i, 1);
  }

  document.getElementById("filters").addEventListener("click", function (e) {
    var btn = e.target.closest(".chip, #reset");
    if (!btn) return;
    if (btn.id === "reset") {
      filters.language = [];
      filters.group = [];
      filters.scale = [];
      filters.scene = [];
      filters.q = "";
    } else {
      toggleFilter(btn.getAttribute("data-group"), btn.getAttribute("data-value"));
    }
    renderFilters();
    bindSearch();
    renderGallery();
  });

  function bindSearch() {
    var input = document.getElementById("q");
    if (!input) return;
    input.addEventListener("input", function () {
      filters.q = input.value.trim();
      renderGallery();
    });
  }

  /* Lightbox */
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");
  var lbIdx = 0;
  var lbList = [];

  function openLb(list, idx) {
    lbList = list;
    lbIdx = idx;
    showLb();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
  }
  function closeLb() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    lbImg.removeAttribute("src");
  }
  function showLb() {
    var it = lbList[lbIdx];
    if (!it || !it.thumb) return;
    lbImg.src = it.thumb;
    lbImg.alt = it.name + " 截图放大";
    lbCap.innerHTML = "<div><strong>" + esc(it.name) + "</strong><div>" + esc(it.language || "") +
      (it.scale ? " · " + esc(it.scale) : "") + " · " + esc(it.sourceSite || it.sourceGroup) +
      "</div></div><span>" + (lbIdx + 1) + " / " + lbList.length + "</span>";
  }
  function prevLb() { if (!lbList.length) return; lbIdx = (lbIdx + lbList.length - 1) % lbList.length; showLb(); }
  function nextLb() { if (!lbList.length) return; lbIdx = (lbIdx + 1) % lbList.length; showLb(); }

  document.getElementById("gallery").addEventListener("click", function (e) {
    var t = e.target.closest(".thumb");
    if (!t || t.classList.contains("thumb-missing")) return;
    var idx = parseInt(t.getAttribute("data-idx"), 10);
    if (isNaN(idx)) return;
    var list = visibleForLightbox.filter(function (it) { return it.thumb && !it.thumbMissing; });
    var it = visibleForLightbox[idx];
    var i = list.indexOf(it);
    if (i < 0) i = 0;
    openLb(list, i);
  });
  document.getElementById("held").addEventListener("click", function (e) {
    var t = e.target.closest(".thumb");
    if (!t || t.classList.contains("thumb-missing")) return;
    var list = held.filter(function (it) { return it.thumb && !it.thumbMissing; });
    if (!list.length) return;
    openLb(list, 0);
  });
  document.getElementById("lb-close").addEventListener("click", closeLb);
  document.getElementById("lb-prev").addEventListener("click", function (e) { e.stopPropagation(); prevLb(); });
  document.getElementById("lb-next").addEventListener("click", function (e) { e.stopPropagation(); nextLb(); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") prevLb();
    if (e.key === "ArrowRight") nextLb();
  });

  renderFilters();
  bindSearch();
  renderGallery();
  renderHeld();
})();
