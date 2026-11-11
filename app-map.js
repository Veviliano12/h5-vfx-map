
(function () {
  const D = window.MAP_DATA;
  if (!D || !D.cases) {
    const g = document.getElementById("grid");
    if (g) g.innerHTML = "<p style='padding:16px;color:#666'>没有载入到地图数据。请保留同目录下的 data/map-cases.js 与 thumbs/。</p>";
    return;
  }
  const C = {};
  D.cases.forEach((c) => (C[c.id] = c));
  let scene = "全部";
  const esc = (s) =>
    String(s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const src = (c, full) => {
    if (!c.thumb) return "";
    if (D.img) return D.img[c.id + (full ? "f" : "t")] || "";
    return full ? c.thumb_full : c.thumb;
  };
  function count(name) {
    if (name === "全部") return D.cases.length;
    return D.cases.filter((c) => c.scenes.includes(name)).length;
  }
  function pills(c, showScene) {
    let h = "";
    if (c.kind === "视觉参考") h += '<span class="pill ref">视觉参考</span>';
    if (c.bend && (showScene || scene === "落地页" || scene === "全部")) h += '<span class="pill bend">B 端产品介绍</span>';
    if (c.capture_failed) h += '<span class="pill fail">截图失败</span>';
    if (showScene) c.scenes.forEach((s) => (h += `<span class="pill">${esc(s)}</span>`));
    return h;
  }
  function card(c, showScene) {
    const pic = c.capture_failed
      ? `<div class="placeholder">截图失败，可点开原站</div>`
      : `<div class="pic"><img loading="lazy" src="${src(c)}" alt="${esc(c.name)}"></div>`;
    return `<button class="card" data-id="${c.id}">${pic}<div class="meta"><b>${esc(c.name)}</b>${pills(c, showScene)}</div></button>`;
  }
  function emptyNote(row, scale) {
    if (scene === "全部") return `这个组合下还没有案例`;
    return `「${scene}」里，还没有「${row}」的${scale}案例`;
  }
  function renderTabs() {
    const tabs = [{ name: "全部", kind: "all" }, ...D.scenes];
    document.getElementById("tabs").innerHTML = tabs
      .map((t) => {
        const label = t.kind === "supplement" ? t.name + "（补充）" : t.name;
        return `<button class="tab${t.kind === "supplement" ? " sub" : ""}${scene === t.name ? " on" : ""}" data-scene="${esc(t.name)}">${esc(label)}<span class="n">${count(t.name)}</span></button>`;
      })
      .join("");
  }
  function renderGrid() {
    const showScene = scene === "全部";
    const list = scene === "全部" ? D.cases : D.cases.filter((c) => c.scenes.includes(scene));
    let h = `<div class="th">视效语言</div><div class="th">整页 · 整个页面都好看</div><div class="th">组件 · 按钮、卡片、局部材质</div>`;
    D.rows.forEach((r) => {
      h += `<div class="rh"><b>${esc(r.name)}</b><span>${esc(r.desc)}</span></div>`;
      D.scales.forEach((sc) => {
        const items = list.filter((c) => c.row === r.name && c.scale === sc);
        if (!items.length) h += `<div class="cell"><div class="empty">${esc(emptyNote(r.name, sc))}</div></div>`;
        else h += `<div class="cell">${items.map((c) => card(c, showScene)).join("")}</div>`;
      });
    });
    document.getElementById("grid").innerHTML = h;
    if (window.VFXAnnotate) window.VFXAnnotate.decorate(document.getElementById("grid"));
  }
  function openModal(id) {
    const c = C[id];
    if (!c) return;
    const img = c.capture_failed
      ? `<div class="placeholder-big">截图失败，可点开原站<br>加长等待后，公开预览仍没有可用画面。</div>`
      : `<img src="${src(c, true)}" alt="${esc(c.name)}">`;
    const sc = c.scenes.map((s) => esc(s) + (s === "落地页" && c.bend ? "（含 B 端产品介绍）" : "")).join(" · ");
    document.getElementById("box").innerHTML = `
    <div class="imgwrap">${img}</div>
    <div class="info">
      <span class="x" id="cx">×</span>
      <h2>${esc(c.name)}</h2>
      <div class="meta">${esc(c.row)} · ${esc(c.scale)} · ${sc}${c.studio ? " · " + esc(c.studio) : ""}${c.kind === "视觉参考" ? " · 视觉参考" : ""}</div>
      <div class="lab">为什么在这里</div><div>${esc(c.reason)}</div>
      ${c.visible ? `<div class="lab">截图里看到</div><div>${esc(c.visible)}</div>` : ""}
      ${c.gary_note ? `<div class="lab">你的批注</div><div>${esc(c.gary_note)}</div>` : ""}
      ${c.tags && c.tags.length ? `<div class="lab">子类型</div><div>${c.tags.map((t) => '<span class="pill">' + esc(t) + "</span>").join("")}</div>` : ""}
      ${c.image_note ? `<div class="lab">截图说明</div><div>${esc(c.image_note)}</div>` : ""}
      ${c.capture_note ? `<div class="lab">拍摄</div><div>${esc(c.capture_note)}</div>` : ""}
      <a class="go" href="${esc(c.url)}" target="_blank" rel="noopener">打开原站 ↗</a>
      <div class="meta" style="margin-top:6px;word-break:break-all">${esc(c.url)}</div>
    </div>`;
    document.getElementById("m").classList.add("on");
    document.getElementById("cx").onclick = () => document.getElementById("m").classList.remove("on");
    if (window.VFXAnnotate) window.VFXAnnotate.mountPanel(document.querySelector("#m .info"), id);
  }
  document.getElementById("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-scene]");
    if (!b) return;
    scene = b.getAttribute("data-scene");
    renderTabs();
    renderGrid();
  });
  document.getElementById("grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) openModal(b.getAttribute("data-id"));
  });
  document.getElementById("m").addEventListener("click", (e) => {
    if (e.target.id === "m") e.target.classList.remove("on");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById("m").classList.remove("on");
  });
  renderTabs();
  renderGrid();
})();
