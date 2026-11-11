/* H5 高阶视效 · 全景地图 · 来源清单 */
(function () {
  const STORE = "h5-vfx-literature-v1";
  const PAGE_SIZE = 40;
  const STATUS_CN = { absorbed: "已吸收", rejected: "不吸收", pending: "待定" };

  function hydrate(it) {
    const o = Object.assign({}, it);
    o.channels = o.channels && o.channels.length ? o.channels : [o.channel];
    o.origins = o.origins && o.origins.length ? o.origins : [o.origin];
    o.note = o.note || "";
    o.studio = o.studio || "";
    o.author = o.author || "";
    o.author_name = o.author_name || "";
    o.date = o.date || "";
    o.tag = o.tag || "";
    o.excerpt = o.excerpt || "";
    o.source_detail = o.source_detail || "";
    o.inherited = !!o.inherited;
    o.inherited_from = o.inherited_from || "";
    o.note_from_review = !!o.note_from_review;
    o.map = o.map || null;
    if (!o.thumb_kind) {
      o.thumb_kind = o.thumb ? (String(o.thumb).indexOf("http") === 0 ? "remote" : "local") : "none";
    }
    o.thumb = o.thumb || "";
    return o;
  }

  if (typeof LIT_CORE === "undefined" || typeof LIT_SITES === "undefined" || typeof LIT_X === "undefined") {
    document.getElementById("list").innerHTML =
      '<p class="empty">没有载入到清单数据。请把 <code>index.html</code>、<code>data/</code> 和 <code>thumbs/</code> 放在同一目录后，再双击打开。不要只拷走这一个 HTML。</p>';
    return;
  }

  const ITEMS = []
    .concat(LIT_CORE || [], LIT_SITES || [], LIT_X || [])
    .map(hydrate);
  const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
  const BLOCKS = LIT_BLOCKS || [];
  const META = LIT_META || {};
  const COV = (typeof LIT_COVERAGE !== "undefined" && LIT_COVERAGE) || { rows: [], scenes: [], scales: [], cases: [] };

  const DEFAULTS = {};
  ITEMS.forEach((it) => {
    DEFAULTS[it.id] = { status: it.status, note: it.note || "" };
  });

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveStore() {
    localStorage.setItem(
      STORE,
      JSON.stringify({ version: 1, saved_at: new Date().toISOString(), items: state.items })
    );
  }

  const loaded = loadStore();
  const state = {
    items: loaded.items && typeof loaded.items === "object" ? loaded.items : {},
    tab: "sources",
    block: "all",
    channel: "all",
    filter: "all",
    q: "",
    page: 1,
    currentId: null,
    showNote: {},
  };

  function statusOf(it) {
    const ov = state.items[it.id];
    if (ov && ov.status) return ov.status;
    return DEFAULTS[it.id].status;
  }
  function noteOf(it) {
    const ov = state.items[it.id];
    if (ov && Object.prototype.hasOwnProperty.call(ov, "note")) return ov.note || "";
    return DEFAULTS[it.id].note || "";
  }
  function setItemState(id, patch) {
    const it = BY_ID.get(id);
    if (!it) return;
    const cur = state.items[id] || {};
    const next = {
      status: patch.status !== undefined ? patch.status : cur.status || statusOf(it),
      note: patch.note !== undefined ? patch.note : Object.prototype.hasOwnProperty.call(cur, "note") ? cur.note : noteOf(it),
    };
    const d = DEFAULTS[id];
    if (next.status === d.status && (next.note || "") === (d.note || "")) {
      delete state.items[id];
    } else {
      state.items[id] = next;
    }
    saveStore();
  }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function countsFor(list) {
    const c = { total: list.length, absorbed: 0, rejected: 0, pending: 0 };
    list.forEach((it) => {
      c[statusOf(it)]++;
    });
    return c;
  }

  function allCounts() {
    return countsFor(ITEMS);
  }

  function blockItems(blockId) {
    if (!blockId || blockId === "all") return ITEMS;
    return ITEMS.filter((it) => it.block === blockId);
  }

  function matchesQuery(it, q) {
    if (!q) return true;
    const note = noteOf(it);
    const blob = [
      it.name,
      it.url,
      it.channel,
      (it.channels || []).join(" "),
      it.source_detail,
      it.studio,
      it.author,
      it.author_name,
      it.excerpt,
      it.tag,
      note,
    ]
      .join("\n")
      .toLowerCase();
    return blob.indexOf(q) !== -1;
  }

  function visibleItems() {
    const q = state.q.trim().toLowerCase();
    const list = ITEMS.filter((it) => {
      if (state.block !== "all" && it.block !== state.block) return false;
      if (state.channel !== "all" && it.channel !== state.channel) return false;
      if (state.filter !== "all" && statusOf(it) !== state.filter) return false;
      if (!matchesQuery(it, q)) return false;
      return true;
    });
    if (state.filter === "rejected") {
      return list.slice().sort((a, b) => {
        const an = noteOf(a) ? 0 : 1;
        const bn = noteOf(b) ? 0 : 1;
        if (an !== bn) return an - bn;
        return a.name.localeCompare(b.name, "zh");
      });
    }
    return list;
  }

  function renderBar() {
    const c = allCounts();
    $("#progress").textContent = "共 " + c.total;
    $("#c-ok").textContent = "已吸收 " + c.absorbed;
    $("#c-no").textContent = "不吸收 " + c.rejected;
    $("#c-un").textContent = "待定 " + c.pending;
    const sc = document.getElementById("src-count");
    if (sc) sc.textContent = c.total + " 条";
    $$("[data-filter]").forEach((p) => p.classList.toggle("active", p.dataset.filter === state.filter));
  }

  function renderBlocks() {
    const cards = [];
    const all = allCounts();
    cards.push(blockCard("all", "全部来源", "七个大块合计。点某一块只看该渠道。", all, state.block === "all"));
    BLOCKS.forEach((b) => {
      const c = countsFor(blockItems(b.id));
      cards.push(blockCard(b.id, b.name, b.desc, c, state.block === b.id));
    });
    $("#blocks").innerHTML = cards.join("");
  }

  function blockCard(id, name, desc, c, active) {
    return (
      '<button type="button" class="bcard' +
      (active ? " active" : "") +
      '" data-block="' +
      esc(id) +
      '">' +
      "<h3>" +
      esc(name) +
      "</h3>" +
      '<div class="n">' +
      c.total +
      "</div>" +
      "<p>" +
      esc(desc) +
      "</p>" +
      '<div class="stats">' +
      '<span class="a">已吸收 ' +
      c.absorbed +
      "</span>" +
      '<span class="r">不吸收 ' +
      c.rejected +
      "</span>" +
      '<span class="p">待定 ' +
      c.pending +
      "</span>" +
      "</div></button>"
    );
  }

  function renderChannels() {
    const root = $("#channels");
    if (state.block === "all") {
      root.innerHTML = "";
      return;
    }
    const block = BLOCKS.find((b) => b.id === state.block);
    const items = blockItems(state.block);
    const chans = [];
    const seen = new Set();
    items.forEach((it) => {
      if (!seen.has(it.channel)) {
        seen.add(it.channel);
        chans.push(it.channel);
      }
    });
    const pills = [
      '<button type="button" class="pill' +
        (state.channel === "all" ? " active" : "") +
        '" data-channel="all">全部小类</button>',
    ];
    chans.forEach((ch) => {
      const c = countsFor(items.filter((it) => it.channel === ch));
      pills.push(
        '<button type="button" class="pill' +
          (state.channel === ch ? " active" : "") +
          '" data-channel="' +
          esc(ch) +
          '">' +
          esc(ch) +
          " " +
          c.total +
          "</button>"
      );
    });
    root.innerHTML = pills.join("");
  }

  function thumbHTML(it, name) {
    if (it.thumb_kind === "none" || !it.thumb) {
      return '<div class="ph">暂无预览</div>';
    }
    const src = esc(it.thumb);
    return (
      '<img src="' +
      src +
      '" alt="' +
      esc(name) +
      '" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<div class=ph>暂无预览</div>\'">'
    );
  }

  function cardHTML(it) {
    const st = statusOf(it);
    const note = noteOf(it);
    const showNote = !!state.showNote[it.id] || st === "rejected";
    const cls =
      "card" +
      (state.currentId === it.id ? " current" : "") +
      (st === "absorbed" ? " v-absorbed" : "") +
      (st === "rejected" ? " v-rejected" : "") +
      (showNote ? " show-note" : "");
    const tags = [];
    tags.push(blockName(it.block));
    if (it.channel) tags.push(it.channel);
    (it.channels || []).forEach((ch) => {
      if (ch !== it.channel && tags.indexOf(ch) === -1) tags.push(ch);
    });
    if (it.studio) tags.push(it.studio);
    if (it.author) tags.push("@" + it.author);
    if (it.date) tags.push(it.date + "（北美东部时间）");
    if (it.tag && it.tag !== it.channel) tags.push(it.tag);
    if (it.map) {
      tags.push(it.map.row);
      (it.map.scenes || []).forEach((s) => tags.push(s));
      if (it.map.scale) tags.push(it.map.scale);
    }
    const badges = [];
    if (it.map) badges.push('<span class="badge gold">已入地图</span>');
    else if (it.inherited) badges.push('<span class="badge inherit">沿用已审判断</span>');
    const excerpt = it.excerpt ? '<p class="excerpt">' + esc(it.excerpt) + "</p>" : "";
    const detail = it.source_detail ? '<p class="detail">' + esc(it.source_detail) + "</p>" : "";
    const inherit = it.inherited && it.inherited_from ? '<p class="mine">沿用自清单中的「' + esc(labelOf(it.inherited_from)) + "」</p>" : "";
    const defaultNote = it.note_from_review && DEFAULTS[it.id].note ? '<p class="mine">原审看批注：' + esc(DEFAULTS[it.id].note) + "</p>" : "";
    return (
      '<article class="' +
      cls +
      '" data-id="' +
      esc(it.id) +
      '" id="c-' +
      esc(it.id) +
      '">' +
      '<div class="shot">' +
      thumbHTML(it, it.name) +
      (it.origin === "x" && it.channel ? '<span class="badge">' + esc(it.channel) + "</span>" : "") +
      badges.join("") +
      "</div>" +
      '<div class="body">' +
      " <h3><a href=\"" +
      esc(it.url) +
      '" target="_blank" rel="noopener">' +
      esc(it.name) +
      "</a></h3>" +
      '<div class="meta">' +
      tags.map((t) => '<span class="tag">' + esc(t) + "</span>").join("") +
      "</div>" +
      excerpt +
      detail +
      inherit +
      defaultNote +
      '<div class="rowbtns">' +
      '<button type="button" class="vbtn absorbed' +
      (st === "absorbed" ? " sel" : "") +
      '" data-act="absorbed">已吸收</button>' +
      '<button type="button" class="vbtn rejected' +
      (st === "rejected" ? " sel" : "") +
      '" data-act="rejected">不吸收</button>' +
      '<button type="button" class="vbtn pending' +
      (st === "pending" ? " sel" : "") +
      '" data-act="pending">待定</button>' +
      '<button type="button" class="linknote" data-act="note">' +
      (note ? "改原因 / 备注" : "填写原因或备注") +
      "</button>" +
      '<a class="open" href="' +
      esc(it.url) +
      '" target="_blank" rel="noopener">打开原站</a>' +
      "</div>" +
      (st === "rejected"
        ? '<p class="note-hint">' + (note ? "" : "不吸收建议写明原因，写好会一起保存。") + "</p>"
        : "") +
      '<textarea class="note" data-act="note-field" placeholder="不吸收的原因，或其他备注">' +
      esc(note) +
      "</textarea>" +
      "</div></article>"
    );
  }

  function blockName(id) {
    const b = BLOCKS.find((x) => x.id === id);
    return b ? b.name : id;
  }
  function labelOf(id) {
    const it = BY_ID.get(id);
    return it ? it.name : id;
  }

  function renderList() {
    const list = visibleItems();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    const blockLabel = state.block === "all" ? "全部来源" : blockName(state.block);
    const chLabel = state.channel === "all" ? "" : " · " + state.channel;
    $("#list-title").textContent = blockLabel + chLabel;
    $("#list-sub").textContent =
      "本筛选项下 " + list.length + " 条，第 " + state.page + " / " + pages + " 页（每页 " + PAGE_SIZE + " 条，避免一次渲染全部清单）。";

    if (!slice.length) {
      $("#list").innerHTML = '<p class="empty">这一筛选项下暂时没有条目。</p>';
    } else {
      $("#list").innerHTML = slice.map(cardHTML).join("");
    }
    renderPager(pages, list.length);
  }

  function renderPager(pages, total) {
    const root = $("#pager");
    if (total <= PAGE_SIZE) {
      root.innerHTML = "";
      return;
    }
    const btns = [];
    btns.push(
      '<button type="button" class="btn sec" data-page="' +
        Math.max(1, state.page - 1) +
        '"' +
        (state.page === 1 ? " disabled" : "") +
        ">上一页</button>"
    );
    const windowPages = pageWindow(state.page, pages);
    windowPages.forEach((p) => {
      if (p === "…") {
        btns.push("<span class='keys'>…</span>");
        return;
      }
      btns.push(
        '<button type="button" class="btn sec' +
          (p === state.page ? " active" : "") +
          '" data-page="' +
          p +
          '">' +
          p +
          "</button>"
      );
    });
    btns.push(
      '<button type="button" class="btn sec" data-page="' +
        Math.min(pages, state.page + 1) +
        '"' +
        (state.page === pages ? " disabled" : "") +
        ">下一页</button>"
    );
    root.innerHTML = btns.join("");
  }

  function pageWindow(cur, pages) {
    const set = new Set([1, pages, cur, cur - 1, cur + 1, cur - 2, cur + 2]);
    const nums = Array.from(set)
      .filter((n) => n >= 1 && n <= pages)
      .sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i && n - nums[i - 1] > 1) out.push("…");
      out.push(n);
    });
    return out;
  }

  function renderSources() {
    renderBar();
    renderBlocks();
    renderChannels();
    renderList();
  }

  function setTab(tab) {
    state.tab = tab;
    document.body.classList.toggle("show-coverage", tab === "coverage");
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    if (tab === "coverage") renderCoverage();
  }

  function renderCoverage() {
    $("#cov-disclaimer").innerHTML = "<b>说明：</b>" + esc(COV.disclaimer || "");
    const cases = COV.cases || [];
    const rows = COV.rows || [];
    const scenes = COV.scenes || [];
    const scales = COV.scales || ["整页", "组件"];
    const absorbed = ITEMS.filter((it) => statusOf(it) === "absorbed");
    const inMapIds = new Set(cases.map((c) => c.id));
    const uncat = absorbed.filter((it) => !inMapIds.has(it.id));

    const filled = new Set();
    cases.forEach((c) => {
      (c.scenes || []).forEach((sc) => filled.add(c.row + "||" + sc));
    });
    const totalCells = rows.length * scenes.length;
    $("#cov-sum").innerHTML =
      '<span class="pill ok">地图中 ' +
      cases.length +
      " 例</span>" +
      '<span class="pill">已填格子 ' +
      filled.size +
      " / " +
      totalCells +
      "</span>" +
      '<span class="pill">空格 ' +
      (totalCells - filled.size) +
      "</span>" +
      (uncat.length ? '<span class="pill wait">已吸收但未入格 ' + uncat.length + "</span>" : "");

    let head = "<thead><tr><th>视效语言</th>";
    scenes.forEach((s) => {
      head +=
        '<th class="scene" title="' +
        esc((s.desc || "") + (s.kind === "supplement" ? "（补充类，不是官方分类）" : "")) +
        '">' +
        esc(s.name) +
        (s.kind === "supplement" ? '<span class="sub">补充</span>' : "") +
        "</th>";
    });
    head += "</tr></thead>";
    let body = "<tbody>";
    rows.forEach((r) => {
      body += '<tr><td class="rowname">' + esc(r.name) + '<span class="sub">' + esc(r.desc || "") + "</span></td>";
      scenes.forEach((s) => {
        const cellCases = cases.filter((c) => c.row === r.name && (c.scenes || []).indexOf(s.name) !== -1);
        if (!cellCases.length) {
          body += '<td class="cell empty">空</td>';
          return;
        }
        const byScale = {};
        scales.forEach((sc) => (byScale[sc] = []));
        cellCases.forEach((c) => {
          const k = c.scale || "整页";
          if (!byScale[k]) byScale[k] = [];
          byScale[k].push(c);
        });
        const countLine = scales
          .map((sc) => sc + " " + (byScale[sc] || []).length)
          .join("　");
        const thumbs = cellCases
          .slice(0, 4)
          .map((c) => {
            if (c.thumb) {
              return (
                '<img src="' +
                esc(c.thumb) +
                '" alt="' +
                esc(c.name) +
                '" loading="lazy" onerror="this.outerHTML=\'<span class=mini-ph>无</span>\'">'
              );
            }
            return '<span class="mini-ph">无</span>';
          })
          .join("");
        body +=
          '<td class="cell" data-row="' +
          esc(r.name) +
          '" data-scene="' +
          esc(s.name) +
          '"><div class="counts">' +
          esc(countLine) +
          '</div><div class="thumbs">' +
          thumbs +
          (cellCases.length > 4 ? '<span class="mini-ph">+' + (cellCases.length - 4) + "</span>" : "") +
          "</div></td>";
      });
      body += "</tr>";
    });
    body += "</tbody>";
    $("#matrix").innerHTML = head + body;

    const emptyScenes = (COV.empty_scenes || []).join("、") || "无";
    const emptyRows = rows
      .filter((r) => !cases.some((c) => c.row === r.name))
      .map((r) => r.name);
    let uncatHtml = "<h3>空的分类</h3><p>目前没有案例的场景列：" + esc(emptyScenes) + "。";
    if (emptyRows.length) uncatHtml += "完全空白的视效语言行：" + esc(emptyRows.join("、")) + "。";
    else uncatHtml += "九条视效语言行都至少有一例。";
    uncatHtml += "</p>";
    if (uncat.length) {
      uncatHtml +=
        "<h3>已吸收、但还没落入地图格子</h3><p>这些条目在来源侧标成了已吸收（例如沿用了已审站点的判断），但还没有写进场景页签地图。共 " +
        uncat.length +
        " 条。</p><ul>" +
        uncat
          .map(
            (it) =>
              "<li><a href=\"" +
              esc(it.url) +
              '" target="_blank" rel="noopener">' +
              esc(it.name) +
              "</a> · " +
              esc(blockName(it.block)) +
              (it.inherited ? " · 沿用判断" : "") +
              "</li>"
          )
          .join("") +
        "</ul>";
    } else {
      uncatHtml += "<p>当前所有「已吸收」且属于地图案例的条目都已落入格子。来源里若再勾选新的已吸收，会出现在这里，等待归类。</p>";
    }
    $("#uncat").innerHTML = uncatHtml;
    $("#cov-detail").innerHTML = "";
  }

  function showCellDetail(row, scene) {
    const cases = (COV.cases || []).filter((c) => c.row === row && (c.scenes || []).indexOf(scene) !== -1);
    $("#cov-detail").innerHTML =
      "<h3>" +
      esc(row) +
      " × " +
      esc(scene) +
      "（" +
      cases.length +
      "）</h3>" +
      cases
        .map((c) => {
          const it = BY_ID.get(c.id);
          return it ? cardHTML(it) : "<p>" + esc(c.name) + "</p>";
        })
        .join("");
    $("#cov-detail").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function showReasons() {
    const list = ITEMS.filter((it) => statusOf(it) === "rejected").slice().sort((a, b) => {
      const an = noteOf(a) ? 0 : 1;
      const bn = noteOf(b) ? 0 : 1;
      if (an !== bn) return an - bn;
      return a.name.localeCompare(b.name, "zh");
    });
    const withNote = list.filter((it) => noteOf(it));
    const without = list.filter((it) => !noteOf(it));
    const rows = list
      .map((it) => {
        const n = noteOf(it);
        return (
          '<div class="reason"><b>' +
          esc(it.name) +
          "</b> · " +
          esc(blockName(it.block)) +
          '<div class="why">' +
          (n ? esc(n) : "（未填写原因）") +
          "</div></div>"
        );
      })
      .join("");
    openModal(
      "不吸收原因",
      "<p>共不吸收 " +
        list.length +
        " 条，其中 " +
        withNote.length +
        " 条写了原因，" +
        without.length +
        " 条未填。预填的 105 条里，只有当时写下批注的才带了原因，其余不会代为编写。</p>" +
        rows
    );
  }

  function openModal(title, body) {
    closeModal();
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.id = "modal";
    bg.innerHTML = '<div class="modal"><h2>' + esc(title) + '</h2><div>' + body + '</div><p style="margin:16px 0 0"><button type="button" class="btn" id="modal-close">关闭</button></p></div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", (e) => {
      if (e.target === bg || e.target.id === "modal-close") closeModal();
    });
  }
  function closeModal() {
    const m = $("#modal");
    if (m) m.remove();
  }

  function setCurrent(id, scroll) {
    state.currentId = id;
    $$(".card.current").forEach((el) => el.classList.remove("current"));
    const el = document.getElementById("c-" + id);
    if (el) {
      el.classList.add("current");
      if (scroll) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function setStatus(id, status) {
    const it = BY_ID.get(id);
    if (!it) return;
    const cur = statusOf(it);
    // clicking the same status does not clear it; use 待定 to reset
    setItemState(id, { status: status });
    if (status === "rejected") state.showNote[id] = true;
    const card = document.getElementById("c-" + id);
    if (card) {
      card.outerHTML = cardHTML(it);
      const el = document.getElementById("c-" + id);
      if (el) {
        el.classList.add("current");
        const ta = el.querySelector(".note");
        if (status === "rejected" && ta) ta.focus();
      }
    }
    state.currentId = id;
    renderBar();
    renderBlocks();
    renderChannels();
    // list subtitle counts
    const list = visibleItems();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    $("#list-sub").textContent =
      "本筛选项下 " + list.length + " 条，第 " + state.page + " / " + pages + " 页（每页 " + PAGE_SIZE + " 条，避免一次渲染全部清单）。";
  }

  function exportState() {
    const c = allCounts();
    const items = ITEMS.filter((it) => {
      const st = statusOf(it);
      const note = noteOf(it);
      const d = DEFAULTS[it.id];
      return st !== "pending" || note || st !== d.status || note !== (d.note || "");
    }).map((it) => ({
      id: it.id,
      name: it.name,
      url: it.url,
      block: it.block,
      channel: it.channel,
      status: statusOf(it),
      note: noteOf(it),
      inherited: it.inherited || false,
      inherited_from: it.inherited_from || "",
    }));
    const out = {
      title: "H5高阶视效 · 文献参考状态",
      exported_at: new Date().toISOString(),
      counts: c,
      pending_omitted: true,
      note: "待定且无备注的条目未逐条写出，导入时会保留当前或预填状态。",
      items: items,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "文献参考状态.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyImport(data) {
    let arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data && Array.isArray(data.items)) arr = data.items;
    else if (data && Array.isArray(data.judgments)) {
      arr = data.judgments.map((j) => ({
        id: j.id,
        url: j.url,
        status: j.verdict === "ok" ? "absorbed" : j.verdict === "no" ? "rejected" : j.verdict === "unread" ? "pending" : j.status,
        note: j.note || "",
      }));
    } else {
      alert("无法识别这份 JSON。请使用本页导出的文件，或带 items / judgments 数组的判断文件。");
      return;
    }
    const byUrl = new Map();
    ITEMS.forEach((it) => {
      const u = (it.url || "").replace(/\/$/, "").toLowerCase();
      if (u && !byUrl.has(u)) byUrl.set(u, it.id);
    });
    let n = 0;
    arr.forEach((row) => {
      if (!row) return;
      let id = row.id;
      if (!BY_ID.has(id) && row.url) {
        id = byUrl.get(String(row.url).replace(/\/$/, "").toLowerCase());
      }
      if (!id || !BY_ID.has(id)) return;
      let st = row.status;
      if (st === "ok") st = "absorbed";
      if (st === "no") st = "rejected";
      if (st === "unread") st = "pending";
      if (st !== "absorbed" && st !== "rejected" && st !== "pending") return;
      setItemState(id, { status: st, note: row.note || "" });
      n++;
    });
    renderSources();
    alert("已导入 " + n + " 条状态。");
  }

  function resetDefaults() {
    if (!confirm("恢复为预填判断？你在本页新勾的状态和备注会被清除，149 条种子和地图案例会回到原来的已吸收 / 不吸收。")) return;
    state.items = {};
    saveStore();
    renderSources();
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#pane-sources, #src-toolbar, .modal-bg")) return;
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      setTab(tab.dataset.tab);
      return;
    }
    const block = e.target.closest("[data-block]");
    if (block) {
      state.block = block.dataset.block;
      state.channel = "all";
      state.page = 1;
      renderSources();
      return;
    }
    const ch = e.target.closest("[data-channel]");
    if (ch) {
      state.channel = ch.dataset.channel;
      state.page = 1;
      renderSources();
      return;
    }
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      state.filter = filter.dataset.filter;
      state.page = 1;
      renderSources();
      return;
    }
    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn && !pageBtn.disabled) {
      state.page = parseInt(pageBtn.dataset.page, 10) || 1;
      renderList();
      const title = $("#list-title");
      if (title) title.scrollIntoView({ block: "start" });
      return;
    }
    if (e.target.id === "btn-export") {
      exportState();
      return;
    }
    if (e.target.id === "btn-import") {
      $("#import-file").click();
      return;
    }
    if (e.target.id === "btn-reset") {
      resetDefaults();
      return;
    }
    if (e.target.id === "btn-reasons") {
      showReasons();
      return;
    }
    const cell = e.target.closest("td.cell[data-row]");
    if (cell) {
      showCellDetail(cell.dataset.row, cell.dataset.scene);
      return;
    }
    const card = e.target.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    setCurrent(id, false);
    const act = e.target.closest("[data-act]") && e.target.closest("[data-act]").dataset.act;
    if (act === "absorbed" || act === "rejected" || act === "pending") setStatus(id, act);
    if (act === "note") {
      state.showNote[id] = !state.showNote[id];
      card.outerHTML = cardHTML(BY_ID.get(id));
      const el = document.getElementById("c-" + id);
      if (el) {
        el.classList.add("current");
        const ta = el.querySelector(".note");
        if (ta) ta.focus();
      }
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "search") {
      state.q = e.target.value;
      state.page = 1;
      // don't rebuild block cards every keystroke more than needed
      renderChannels();
      renderList();
      renderBar();
      return;
    }
    if (!e.target.classList.contains("note")) return;
    const card = e.target.closest(".card");
    if (!card) return;
    setItemState(card.dataset.id, { note: e.target.value });
  });

  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImport(JSON.parse(reader.result));
      } catch (err) {
        alert("JSON 解析失败。");
      }
    };
    reader.readAsText(file);
  });

  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("show-sources")) return;
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    const list = visibleItems();
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    const ids = slice.map((it) => it.id);
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      let i = ids.indexOf(state.currentId);
      if (i < 0) i = -1;
      if (i < ids.length - 1) setCurrent(ids[i + 1], true);
      else if (state.page * PAGE_SIZE < list.length) {
        state.page++;
        renderList();
        if (ids.length) {
          const next = visibleItems().slice((state.page - 1) * PAGE_SIZE)[0];
          if (next) setCurrent(next.id, true);
        }
      }
    }
    if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      let i = ids.indexOf(state.currentId);
      if (i < 0) i = 0;
      if (i > 0) setCurrent(ids[i - 1], true);
      else if (state.page > 1) {
        state.page--;
        renderList();
        const prev = visibleItems().slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
        if (prev.length) setCurrent(prev[prev.length - 1].id, true);
      }
    }
    if ((e.key === "1" || e.key === "o" || e.key === "O") && state.currentId) setStatus(state.currentId, "absorbed");
    if ((e.key === "2" || e.key === "x" || e.key === "X") && state.currentId) setStatus(state.currentId, "rejected");
    if ((e.key === "0" || e.key === "Backspace") && state.currentId) setStatus(state.currentId, "pending");
    if (e.key === "Enter" && state.currentId) {
      const it = BY_ID.get(state.currentId);
      if (it) window.open(it.url, "_blank", "noopener");
    }
  });

  renderSources();
  if (ITEMS.length) {
    const first = visibleItems()[0];
    if (first) setCurrent(first.id, false);
  }
})();
