/* Standalone export: works even if annotate.js is an older cached copy. */
(function (global) {
  var LOCAL_KEY = "h5-vfx-annotations-v1";
  var NAME_KEY = "h5-vfx-annotator-name";

  function toast(msg, ok) {
    var el = document.getElementById("anno-export-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "anno-export-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.style.cssText = "position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:99999;max-width:min(520px,92vw);background:" + (ok ? "#0d7a4f" : "#9a3b32") + ";color:#fff;padding:16px 18px;border-radius:12px;font-size:16px;line-height:1.55;font-family:inherit;box-shadow:0 10px 32px rgba(0,0,0,.28);text-align:center;";
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      if (el) el.style.display = "none";
    }, 10000);
  }

  function countItems(data) {
    var n = 0;
    Object.keys((data && data.items) || {}).forEach(function (id) {
      var it = data.items[id] || {};
      if ((it.marks && Object.keys(it.marks).length) || (it.notes && it.notes.length)) n += 1;
    });
    return n;
  }

  function downloadFile(text) {
    try {
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "H5-vfx-notes.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    } catch (e) {}
  }

  function exportH5VfxNotes() {
    var name = "";
    try { name = (localStorage.getItem(NAME_KEY) || "").trim(); } catch (e) {}
    var raw = "";
    try { raw = localStorage.getItem(LOCAL_KEY) || ""; } catch (e) {
      toast("读不到这台浏览器里的批注，请确认不是无痕窗口。", false);
      return;
    }
    var data = { items: {} };
    if (raw) {
      try { data = JSON.parse(raw) || { items: {} }; } catch (e) { data = { items: {} }; }
    }
    data.annotatorName = name;
    data.exportedAt = new Date().toISOString();
    if (!countItems(data)) {
      toast(name
        ? "署名还在，但没有找到批注。请确认这是当时做标记的同一个浏览器。"
        : "没有找到批注。请确认这是当时做标记的同一个浏览器，不要用无痕窗口。", false);
      return;
    }
    var text = JSON.stringify(data, null, 2);
    function done(copied) {
      downloadFile(text);
      toast(copied
        ? "已复制。直接回到对话里粘贴发给我就行。"
        : "已开始下载。把下载里的 H5-vfx-notes.json 发给我就行。", true);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () { done(false); });
    } else {
      done(false);
    }
  }

  global.exportH5VfxNotes = exportH5VfxNotes;

})(window);
