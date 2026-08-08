// 麦芽精酿 | 面馆后厨工作台 —— 前端逻辑
const API = "";
let OPTIONS = {};
let LOOKUP_ING = [];   // [{id,name,std_price,unit}]
let LOOKUP_DISH = [];  // [{id,name}]
let LOOKUP_BASE = [];  // [{id,name,unit_cost}]
const STATE = { mod: "dashboard", view: null, edit: null, sopFilter: "" };

// ---------------- 工具 ----------------
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function fmt(v, d = 2) { return (v === null || v === undefined || v === "") ? "" : Number(v).toFixed(d); }
function tags(v) {
  if (!v) return '<span class="muted">—</span>';
  return String(v).split(",").filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("");
}
function marginCell(risk) {
  if (!risk) return '<span class="muted">—</span>';
  const cls = risk.includes("不足") ? "warn" : "ok";
  return `<span class="${cls}">${esc(risk)}</span>`;
}
function sopCell(text) {
  text = text || "";
  const prev = text.length > 46 ? esc(text.slice(0, 46)) + "…" : esc(text);
  return `<span class="sop-prev" title="${esc(text)}">${prev || '<span class="muted">—</span>'}</span>`;
}
function photoCell(url) {
  return url ? `<img src="${esc(url)}" class="thumb" alt="菜品照片" title="菜品照片">` : '<span class="muted">—</span>';
}
function ingName(id) { const r = LOOKUP_ING.find(x => x.id === Number(id)); return r ? r.name : "（已删除）"; }
function dishName(id) { const r = LOOKUP_DISH.find(x => x.id === Number(id)); return r ? r.name : "（已删除）"; }
function baseName(id) { const r = LOOKUP_BASE.find(x => x.id === Number(id)); return r ? r.name : "（已删除）"; }
function ingPrice(id) { const r = LOOKUP_ING.find(x => x.id === Number(id)); return r ? Number(r.std_price) : 0; }
function baseUnitCost(id) { const r = LOOKUP_BASE.find(x => x.id === Number(id)); return r ? Number(r.unit_cost) : 0; }

async function getJSON(url) {
  if (window.__OFFLINE__ && window.__DATA__ && Object.prototype.hasOwnProperty.call(window.__DATA__, url)) {
    return window.__DATA__[url];
  }
  const r = await fetch(API + url); return r.json();
}
async function sendJSON(url, method, body) {
  if (window.__OFFLINE__) { toast("离线只读模式，不可编辑"); return {}; }
  const r = await fetch(API + url, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  return r.json();
}
// 离线只读模式下，拦截一切新建/编辑/删除/导入动作
function offlineGuard() {
  if (window.__OFFLINE__) { toast("离线只读模式，不可编辑数据"); return true; }
  return false;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast";
  setTimeout(() => { t.className = "toast-hidden"; }, 2200);
}
function elFrom(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

// ---------------- 数据加载 ----------------
async function init() {
  OPTIONS = await getJSON("/api/options");
  await refreshLookups();
  document.querySelectorAll(".navbtn").forEach(b => b.onclick = () => switchMod(b.dataset.mod));
  document.getElementById("modal-close").onclick = requestClose;
  document.getElementById("modal-cancel").onclick = requestClose;
  // 遮罩点击不再自动关闭，避免误触空白处即退出、丢失已填内容（见 requestClose）
  switchMod("dashboard");
}
async function refreshLookups() {
  LOOKUP_ING = await getJSON("/api/lookup/ingredients");
  LOOKUP_DISH = await getJSON("/api/lookup/dishes");
  LOOKUP_BASE = await getJSON("/api/lookup/base");
}
function switchMod(mod) {
  STATE.mod = mod; STATE.view = null; STATE.sopFilter = "";
  document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.mod === mod));
  render();
}

// ---------------- 渲染入口 ----------------
async function render() {
  const main = document.getElementById("main");
  if (STATE.mod === "dashboard") return renderDashboard(main);
  if (STATE.mod === "base") return renderModule(main, "base");
  if (STATE.mod === "dish") return renderModule(main, "dish");
  if (STATE.mod === "ing") return renderModule(main, "ing");
  if (STATE.mod === "sale") return renderModule(main, "sale");
  if (STATE.mod === "tpl") return renderTplView(main);
  if (STATE.mod === "guide") return renderGuide(main);
  if (STATE.mod === "memo") return renderMemo(main);
}

// ---------------- 仪表盘 ----------------
function gotoModuleView(mod, view) {
  STATE.mod = mod;
  STATE.view = view || null;
  STATE.sopFilter = "";
  document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.mod === mod));
  render();
}

async function renderDashboard(main) {
  const d = await getJSON("/api/dashboard");
  const cards = [
    { n: d.need_buy, l: "🔴 今日需补货原料", mod: "ing", view: "buy" },
    { n: d.expired, l: "🟡🔴 临期/过期食材", mod: "ing", view: "exp" },
    { n: d.low_margin, l: "⚠️ 毛利不足55%菜品", mod: "dish", view: "all" },
    { n: d.base_count, l: "汤底/酱料底批次", mod: "base", view: "all" },
    { n: d.ing_count, l: "原料在库种类", mod: "ing", view: "all" },
    { n: d.dish_count, l: "菜品研发档案", mod: "dish", view: "all" },
  ];
  main.innerHTML = `
    <div class="toolbar dashboard-toolbar">
      <span class="hint" style="margin:0">数据可一键导出为离线备份包（含数据库+各模块Excel+可托管静态站），用于 iCloud / GitHub Pages 备份。</span>
      <a class="btn-export" id="btn-export-offline" style="margin-left:auto" href="${API}/api/export/offline" target="_blank" rel="noopener">⬇ 导出离线备份包</a>
    </div>
    <div class="cards">
      ${cards.map(c => `<div class="card clickable" data-mod="${c.mod}" data-view="${c.view}"><div class="num">${c.n}</div><div class="lbl">${c.l}</div></div>`).join("")}
    </div>
    <div class="guide-section">
      <h2>开店点检速览</h2>
      <div class="guide-step"><div class="step-no">1</div><div class="step-txt">查看「原料库存台账 → 今日补货清单」安排当日采购</div></div>
      <div class="guide-step"><div class="step-no">2</div><div class="step-txt">查看「临期&过期食材」处理临期、过期原料，规避食安风险</div></div>
      <div class="guide-step"><div class="step-no">3</div><div class="step-txt">查看上方告警卡片，优先处理🔴需补货 / 临期过期 / 毛利不足项</div></div>
      <div class="guide-step"><div class="step-no">4</div><div class="step-txt">打烊后填写「每日销售日报表」，录入营收与各菜品售卖份数</div></div>
      <div class="guide-step"><div class="step-no">5</div><div class="step-txt">导出菜品SOP：菜品研发档案 → 👉菜品完整SOP导出视图 → 导出Excel → iPad 转 PDF 下发后厨</div></div>
    </div>`;
  main.querySelectorAll(".card.clickable").forEach(el => el.onclick = () => gotoModuleView(el.dataset.mod, el.dataset.view));
}

// ---------------- 模块（含视图切换） ----------------
const VIEW_DEFS = {
  base: [
    { key: "all", name: "全部可用底料批次", sub: false },
    { key: "cost", name: "底料-投料成本明细视图", sub: true },
  ],
  dish: [
    { key: "online", name: "全部上线菜品", sub: false },
    { key: "dev", name: "研发测试菜品", sub: false },
    { key: "sop", name: "👉 菜品完整SOP导出视图", sub: false },
    { key: "all", name: "全量菜品总览", sub: false },
    { key: "cost", name: "菜品食材-成本明细视图", sub: true },
  ],
  ing: [
    { key: "buy", name: "今日补货清单", sub: false, export: "/api/export/buy", exportLabel: "导出Excel补货单" },
    { key: "exp", name: "临期&过期食材", sub: false },
    { key: "all", name: "库存全量总览", sub: false },
    { key: "ticket", name: "采购票据对账视图", sub: true },
    { key: "export", name: "仓储盘点导出视图", sub: false, export: "/api/export/inventory", exportLabel: "导出Excel盘点表" },
    { key: "diff", name: "盘点差异视图", sub: false },
  ],
  sale: [
    { key: "daily", name: "销售日报-日期倒序", sub: false },
    { key: "stat", name: "菜品销售统计视图", sub: true },
  ],
};

async function renderModule(main, mod) {
  if (!STATE.view) STATE.view = VIEW_DEFS[mod][0].key;
  const defs = VIEW_DEFS[mod];
  const cur = defs.find(v => v.key === STATE.view);
  const tabs = defs.map(v => `<button class="viewtab ${v.key === STATE.view ? "active" : ""}" data-v="${v.key}">${v.name}</button>`).join("");

  let toolbar = `<button class="btn-primary" id="btn-new">＋ 新建</button>`;
  if (window.__OFFLINE__) toolbar = "";  // 离线只读：隐藏所有编辑/导出按钮
  if (mod === "ing") toolbar += `<button class="btn-primary" id="btn-flow" style="background:#8e44ad">＋ 新增出入库流水</button>`;
  if (mod === "base") toolbar += `<button class="btn-primary" id="btn-print-batch" style="margin-left:8px;background:#9c6b3f">🖨 批量打印底料SOP</button>`;
  if (mod === "sale") toolbar += `<button class="btn-primary" id="btn-import-sale" style="background:#27ae60;margin-left:8px">📥 上传Excel录入</button>`;
  if (cur && cur.export) toolbar += `<a class="btn-export" href="${cur.export}" target="_blank" rel="noopener">⬇ ${cur.exportLabel || "导出Excel"}</a>`;

  let extra = "";
  if (window.__OFFLINE__) extra = "";
  else if (mod === "dish" && cur.key === "sop") {
    const dishes = await getJSON("/api/dishes");
    const online = dishes.filter(d => d.main.status === "正式上线").map(d => d.main.name).sort((a, b) => a.localeCompare(b, "zh"));
    const opts = `<option value="">全部上线菜品（整套手册）</option>` + online.map(n => `<option value="${esc(n)}" ${STATE.sopFilter === n ? "selected" : ""}>${esc(n)}</option>`).join("");
    extra = `<span class="sop-filter">筛选单菜品：<select id="sop-filter">${opts}</select></span>
      <a class="btn-export" id="sop-export" href="/api/export/sop?name=${encodeURIComponent(STATE.sopFilter || "")}" target="_blank" rel="noopener">⬇ 导出Excel（转PDF）</a>
      <button class="btn-primary" id="btn-print-batch" style="margin-left:6px;background:#9c6b3f">🖨 打印PDF</button>`;
  }

  main.innerHTML = `<div class="viewtabs">${tabs}</div><div class="toolbar">${toolbar}</div>${extra ? `<div class="toolbar sop-toolbar">${extra}</div>` : ""}<div id="view-area"></div>`;

  main.querySelectorAll(".viewtab").forEach(t => t.onclick = () => { STATE.view = t.dataset.v; renderModule(main, mod); });
  main.querySelector("#btn-new").onclick = () => openNew(mod);
  const bf = main.querySelector("#btn-flow"); if (bf) bf.onclick = () => openFlowModal(null);
  const sf = main.querySelector("#sop-filter");
  if (sf) sf.onchange = () => { STATE.sopFilter = sf.value; renderModule(main, mod); };
  const pbb = main.querySelector("#btn-print-batch");
  if (pbb) pbb.onclick = () => batchPrint(mod);
  const bis = main.querySelector("#btn-import-sale");
  if (bis) bis.onclick = openSaleImportModal;

  const area = main.querySelector("#view-area");
  if (mod === "base") return renderBaseView(area, cur);
  if (mod === "dish") return renderDishView(area, cur);
  if (mod === "ing") return renderIngView(area, cur);
  if (mod === "sale") return renderSaleView(area, cur);
}

function table(headers, rows, actions = false) {
  let h = `<tr><th>${headers.join("</th><th>")}</th>${actions ? "<th>操作</th>" : ""}</tr>`;
  if (!rows.length) return `<div class="tablewrap"><table>${h}</table></div><div class="empty">暂无数据</div>`;
  const body = rows.map(r => {
    const cells = r.cells.map(c => `<td>${c}</td>`).join("");
    let act = "";
    if (actions && r.actions) {
      act = "<td>" + r.actions.map(a => `<button class="btn-sm ${a.cls}" data-act="${a.fn}" data-id="${r.id}">${a.lbl}</button>`).join(" ") + "</td>";
    }
    return `<tr>${cells}${act}</tr>`;
  }).join("");
  return `<div class="tablewrap"><table>${h}${body}</table></div>`;
}

// ---------------- 底料（汤底/酱料底成本台账）视图 ----------------
async function renderBaseView(area, cur) {
  const data = await getJSON("/api/base");
  if (cur.key === "cost") {
    const headers = ["底料名称", "原料名称", "投料总重量(g)", "原料采购单价(元/kg)", "该原料每克单价", "本锅该原料总成本(元)", "备注"];
    const rows = [];
    data.forEach(b => b.subs.forEach(s => {
      rows.push({ cells: [
        esc(b.main.name), ingName(s.ingredient_id), fmt(s.input_weight, 1),
        fmt(s["原料采购单价(元/kg)"]), fmt(s["该原料每克单价"], 4),
        fmt(s["本锅该原料总成本(元)"]), esc(s.note),
      ] });
    }));
    area.innerHTML = table(headers, rows);
    return;
  }
  let recs = data.map(d => d.main).filter(r => r.status !== "作废弃用");
  recs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
  const headers = ["底料名称", "底料类别", "熬制日期", "总投料量(g/ml)", "整锅物料总成本", "单位成本(元/g或ml)", "保质期(冷藏)", "底料状态"];
  const rows = recs.map(r => ({ id: r.id, cells: [
    esc(r.name), esc(r.category), esc(r.batch_date),
    fmt(r.total_output, 1), fmt(r.total_cost), fmt(r["单位成本(元/g或元/ml)"], 4),
    fmt(r.shelf_life_cold), esc(r.status),
  ], actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "打印SOP", cls: "btn-edit", fn: "print" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  area.innerHTML = table(headers, rows, true);
  bindRowActions(area, "base");
}

// ---------------- 菜品视图 ----------------
async function renderDishView(area, cur) {
  const data = await getJSON("/api/dishes");
  if (cur.key === "sop") {
    let recs = data.map(d => d.main).filter(r => r.status === "正式上线");
    if (STATE.sopFilter) recs = recs.filter(r => r.name === STATE.sopFilter);
    recs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
    const headers = ["菜品名称", "照片", "菜品类别", "出品份量", "制作时长", "风味简介",
      "SOP-预处理要求", "SOP-分步出品流程", "SOP-出品摆盘&出餐标准", "SOP-注意事项&禁忌"];
    const rows = recs.map(r => ({ id: r.id, cells: [
      esc(r.name), photoCell(r.photo), esc(r.category), esc(r.portion), (r.cook_time ? r.cook_time + " 分" : ""),
      sopCell(r.flavor),       sopCell(r.sop_prep), sopCell(r.sop_steps), sopCell(r.sop_plate), sopCell(r.sop_notice),
    ], actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "打印SOP", cls: "btn-edit", fn: "print" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
    area.innerHTML = table(headers, rows, true);
    bindRowActions(area, "dish");
    return;
  }
  if (cur.key === "cost") {
    const headers = ["所属菜品", "来源类型", "食材/底料名称", "单份取用量", "原料单位", "该单项成本(元)", "备注"];
    const rows = [];
    data.forEach(d => d.subs.forEach(s => {
      const stype = s.source_type || "普通原料";
      const nm = stype === "汤底酱料底料" ? baseName(s.base_id) : ingName(s.ingredient_id);
      rows.push({ cells: [
        esc(d.main.name),
        `<span class="tag">${esc(stype)}</span>`,
        esc(nm), fmt(s.amount, 1), esc(s.unit),
        fmt(s["换算到单份该项成本(元)"]), esc(s.note),
      ] });
    }));
    area.innerHTML = table(headers, rows);
    return;
  }
  let recs = data.map(d => d.main);
  if (cur.key === "online") recs = recs.filter(r => r.status === "正式上线");
  if (cur.key === "dev") recs = recs.filter(r => ["研发中", "测试中"].includes(r.status));
  if (cur.key === "online") recs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
  if (cur.key === "all") recs.sort((a, b) => (a.category || "").localeCompare(b.category || "", "zh"));
  if (cur.key === "dev") recs.sort((a, b) => (b.status || "").localeCompare(a.status || "", "zh"));

  let headers, rows;
  if (cur.key === "online") {
    headers = ["菜品名称", "照片", "产品定位标签", "建议售价", "预估食材成本", "毛利率", "毛利风险", "SOP-分步出品流程", "SOP-出品摆盘&出餐标准"];
    rows = recs.map(r => ({ id: r.id, cells: [
      esc(r.name), photoCell(r.photo), tags(r.position_tags), fmt(r.suggested_price), fmt(r.est_cost),
      (fmt(r["毛利率(数值)"] * 100, 1) + "%"), marginCell(r["毛利风险提示"]),
      sopCell(r.sop_steps), sopCell(r.sop_plate),
    ], actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "打印SOP", cls: "btn-edit", fn: "print" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else if (cur.key === "dev") {
    headers = ["菜品名称", "测试反馈", "后续调整步骤", "毛利风险", "研发状态"];
    rows = recs.map(r => ({ id: r.id, cells: [
      esc(r.name), esc((r.test_feedback || "").slice(0, 30)), esc((r.adjustments || "").slice(0, 30)),
      marginCell(r["毛利风险提示"]), esc(r.status),
    ], actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "打印SOP", cls: "btn-edit", fn: "print" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else {
    headers = ["菜品名称", "照片", "类别", "定位标签", "建议售价", "预估成本", "毛利率", "毛利风险", "研发状态"];
    rows = recs.map(r => ({ id: r.id, cells: [
      esc(r.name), photoCell(r.photo), esc(r.category), tags(r.position_tags), fmt(r.suggested_price),
      fmt(r.est_cost), (fmt(r["毛利率(数值)"] * 100, 1) + "%"), marginCell(r["毛利风险提示"]), esc(r.status),
    ], actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "打印SOP", cls: "btn-edit", fn: "print" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  }
  area.innerHTML = table(headers, rows, true);
  bindRowActions(area, "dish");
}

// ---------------- 原料视图 ----------------
async function renderIngView(area, cur) {
  const ings = await getJSON("/api/ingredients");
  if (cur.key === "ticket") {
    const flows = (await getJSON("/api/flow")).filter(f => f.op_type === "采购入库");
    const headers = ["操作时间", "原料", "本次采购单价", "变动数量", "入库票据", "备注"];
    const rows = flows.map(f => ({ id: f.id, cells: [
      esc(f.op_time), esc(f.ing_name), fmt(f.purchase_price), fmt(f.qty),
      f.ticket_photo ? `<a href="${esc(f.ticket_photo)}" target="_blank">查看📎</a>` : '<span class="muted">—</span>',
      esc(f.note),
    ] }));
    area.innerHTML = table(headers, rows);
    return;
  }
  let recs = ings.slice();
  if (cur.key === "buy") recs = recs.filter(r => r["库存预警状态"] === "🔴需补货");
  if (cur.key === "exp") recs = recs.filter(r => ["🔴已过期", "🟡临期注意"].includes(r["保质期状态"]));
  if (cur.key === "diff") recs = recs.filter(r => Number(r["盘点-库存差异"]) !== 0);
  if (["all", "buy", "exp", "diff"].includes(cur.key)) recs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
  if (cur.key === "export") recs.sort((a, b) => (a.category || "").localeCompare(b.category || "", "zh"));
  if (cur.key === "exp") recs.sort((a, b) => (a.expire_date || "9999").localeCompare(b.expire_date || "9999", "zh"));

  let headers, rows;
  if (cur.key === "buy") {
    headers = ["原料名称", "库存单位", "账面库存", "安全红线", "标准采购单价", "供应商"];
    rows = recs.map(r => ({ id: r.id, cells: [esc(r.name), esc(r.unit), fmt(r.book_stock), fmt(r.safety_line), fmt(r.std_price), esc(r.supplier)],
      actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else if (cur.key === "exp") {
    headers = ["原料名称", "存放位置", "批次生产日期", "最佳使用截止日", "过期截止日", "保质期状态"];
    rows = recs.map(r => ({ id: r.id, cells: [esc(r.name), esc(r.storage), esc(r.batch_prod_date), esc(r.best_before), esc(r.expire_date), esc(r["保质期状态"])],
      actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else if (cur.key === "diff") {
    headers = ["原料名称", "账面库存", "现场实盘", "库存差异", "差异备注"];
    rows = recs.map(r => ({ id: r.id, cells: [esc(r.name), fmt(r.book_stock), fmt(r.physical_stock),
      `<b class="${Number(r['盘点-库存差异']) < 0 ? 'warn' : 'ok'}">${fmt(r['盘点-库存差异'])}</b>`, esc(r["盘点-差异备注"])],
      actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else if (cur.key === "export") {
    headers = ["原料名称", "原料分类", "存放位置", "库存单位", "账面库存", "现场实盘", "库存差异", "标准采购单价", "差异备注", "保质期状态"];
    rows = recs.map(r => ({ id: r.id, cells: [esc(r.name), esc(r.category), esc(r.storage), esc(r.unit),
      fmt(r.book_stock), fmt(r.physical_stock), fmt(r["盘点-库存差异"]), fmt(r.std_price), esc(r["盘点-差异备注"]), esc(r["保质期状态"])],
      actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  } else {
    headers = ["原料名称", "分类", "单位", "供应商", "账面库存", "安全红线", "预警", "保质期状态", "估算单只成本"];
    rows = recs.map(r => ({ id: r.id, cells: [esc(r.name), esc(r.category), esc(r.unit), esc(r.supplier),
      fmt(r.book_stock), fmt(r.safety_line), esc(r["库存预警状态"]), esc(r["保质期状态"]), fmt(r["估算单只/份成本"], 3)],
      actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  }
  area.innerHTML = table(headers, rows, true);
  bindRowActions(area, "ing");
}

// ---------------- 销售视图 ----------------
async function renderSaleView(area, cur) {
  const data = await getJSON("/api/sales");
  if (cur.key === "stat") {
    const headers = ["营业日期", "销售菜品", "售卖份数"];
    const rows = [];
    data.sort((a, b) => (b.main.date || "").localeCompare(a.main.date || "", "zh"));
    data.forEach(s => s.subs.forEach(it => rows.push({ cells: [esc(s.main.date), dishName(it.dish_id), fmt(it.qty, 0)] })));
    area.innerHTML = table(headers, rows);
    return;
  }
  let recs = data.map(d => d.main);
  recs.sort((a, b) => (b.date || "").localeCompare(a.date || "", "zh"));
  const headers = ["营业日期", "备注"];
  const rows = recs.map(r => ({ id: r.id, cells: [esc(r.date), esc(r.note)],
    actions: [{ lbl: "编辑", cls: "btn-edit", fn: "edit" }, { lbl: "删除", cls: "btn-del", fn: "del" }] }));
  area.innerHTML = table(headers, rows, true);
  bindRowActions(area, "sale");
}

function bindRowActions(area, mod) {
  area.querySelectorAll("button[data-act]").forEach(b => {
    b.onclick = () => {
      const id = Number(b.dataset.id);
      if (b.dataset.act === "edit") openEdit(mod, id);
      else if (b.dataset.act === "del") {
        if (confirm("确认删除该记录？")) deleteRecord(mod, id);
      } else if (b.dataset.act === "print") {
        openPrintModal(mod, id);
      }
    };
  });
}
async function deleteRecord(mod, id) {
  const map = { dish: "dishes", ing: "ingredients", sale: "sales", base: "base" };
  await sendJSON(`/api/${map[mod]}/${id}`, "DELETE");
  toast("已删除");
  await refreshLookups();
  render();
}

// ---------------- 模态框 ----------------
let _modalBaseline = null;
function openModal(title) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-save").textContent = "保存";
  document.getElementById("modal").classList.remove("modal-hidden");
  _modalBaseline = null;
  // 表单填充是同步的，下一拍再快照初始值，用于判断是否有未保存修改
  setTimeout(() => { _modalBaseline = _snapModal(); }, 0);
  return document.getElementById("modal-body");
}
function closeModal() { document.getElementById("modal").classList.add("modal-hidden"); }
// 防误触：关闭弹窗前若表单有未保存修改，二次确认，避免误关丢失已填内容
function _snapModal() {
  const body = document.getElementById("modal-body");
  if (!body) return "";
  const els = body.querySelectorAll("[data-key]");
  return Array.from(els).map(e => e.dataset.key + "=" + (e.value != null ? e.value : (e.getAttribute("value") || ""))).join("");
}
function requestClose() {
  if (_modalBaseline !== null && _snapModal() !== _modalBaseline) {
    if (!confirm("当前有未保存的修改，确认放弃？")) return;
  }
  closeModal();
}

function imgField(label, val, key) {
  return `<div class="field full"><label>${label}</label>
    <input type="file" data-upload="${key}" accept="image/*">
    <input type="hidden" data-key="${key}" value="${esc(val)}">
    ${val ? `<img src="${esc(val)}" style="max-height:80px;margin-top:4px;border-radius:6px">` : ""}
  </div>`;
}
function attachUploads(body) {
  body.querySelectorAll("input[data-upload]").forEach(inp => {
    inp.onchange = async () => {
      if (!inp.files.length) return;
      const fd = new FormData(); fd.append("file", inp.files[0]);
      const r = await fetch(API + "/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      const key = inp.dataset.upload;
      body.querySelector(`[data-key="${key}"]`).value = j.url;
      let prev = inp.parentElement.querySelector("img");
      if (!prev) {
        prev = document.createElement("img");
        prev.style.cssText = "max-height:80px;margin-top:4px;border-radius:6px";
        inp.parentElement.appendChild(prev);
      }
      prev.src = j.url;
      toast("图片已上传");
    };
  });
}
function selectOptions(list, val) {
  return list.map(o => `<option value="${esc(o)}" ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("");
}
function multiChecks(list, vals, name) {
  const set = new Set((vals || "").split(",").filter(Boolean));
  return `<div class="field full"><label>${name}</label><div data-multi="${name}">` +
    list.map(o => `<label style="margin-right:12px;font-weight:400"><input type="checkbox" value="${esc(o)}" ${set.has(o) ? "checked" : ""}> ${esc(o)}</label>`).join("") +
    `</div></div>`;
}
function readMulti(body, name) {
  return Array.from(body.querySelectorAll(`[data-multi="${name}"] input:checked`)).map(i => i.value);
}

// ---------------- 通用：新建/编辑入口 ----------------
async function openNew(mod) {
  if (offlineGuard()) return;
  if (mod === "base") openBaseModal(null);
  if (mod === "dish") openDishModal(null);
  if (mod === "ing") openIngModal(null);
  if (mod === "sale") openSaleModal(null);
}
async function openEdit(mod, id) {
  if (offlineGuard()) return;
  if (mod === "base") { const b = (await getJSON("/api/base")).find(x => x.main.id === id); openBaseModal(b); }
  if (mod === "dish") { const d = (await getJSON("/api/dishes")).find(x => x.main.id === id); openDishModal(d); }
  if (mod === "ing") { const i = (await getJSON("/api/ingredients")).find(x => x.id === id); openIngModal(i); }
  if (mod === "sale") { const s = (await getJSON("/api/sales")).find(x => x.main.id === id); openSaleModal(s); }
}

// ---------------- 底料（汤底/酱料底）新建/编辑 ----------------
function baseSubRow(s) {
  s = s || {};
  return `<div class="subrow" data-sub="base">
    <select data-f="ingredient_id">${`<option value="">选择原料</option>` + LOOKUP_ING.map(i => `<option value="${i.id}" ${Number(s.ingredient_id) === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select>
    <input data-f="input_weight" type="number" step="0.1" value="${esc(s.input_weight ?? "")}" placeholder="投料重量(g)">
    <input class="calc" data-f="per_g" readonly value="" title="该原料每克单价">
    <input class="calc" data-f="cost" readonly value="" title="本锅该原料总成本">
    <input data-f="note" value="${esc(s.note ?? "")}" placeholder="备注">
    <button class="sub-del" type="button">✕</button>
  </div>`;
}
function recalcBaseSub(row) {
  const ing = Number(row.querySelector('[data-f="ingredient_id"]').value);
  const w = Number(row.querySelector('[data-f="input_weight"]').value || 0);
  const price = ingPrice(ing);
  const per = price / 1000;
  const cost = w * per;
  row.querySelector('[data-f="per_g"]').value = per.toFixed(6);
  row.querySelector('[data-f="cost"]').value = cost.toFixed(4);
}
function openBaseModal(rec) {
  const m = rec ? rec.main : {};
  const subs = rec ? rec.subs : [];
  const body = openModal(rec ? "编辑底料批次" : "新建底料批次");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>底料名称 *</label><input data-key="name" value="${esc(m.name ?? "")}"></div>
      <div class="field"><label>底料类别</label><select data-key="category">${selectOptions(OPTIONS.base_categories, m.category)}</select></div>
      ${imgField("底料照片", m.photo, "photo")}
      <div class="field"><label>熬制日期</label><input data-key="batch_date" type="date" value="${esc(m.batch_date ?? "")}"></div>
      <div class="field"><label>熬制总投料量(g/ml)</label><input data-key="total_output" type="number" step="0.1" value="${esc(m.total_output ?? "")}"></div>
      <div class="field"><label>整锅物料总成本(元)</label><input data-key="total_cost" type="number" step="0.01" value="${esc(m.total_cost ?? "")}"></div>
      <div class="field"><label>保质期(冷藏,天)</label><input data-key="shelf_life_cold" type="number" step="1" value="${esc(m.shelf_life_cold ?? "")}"></div>
      <div class="field"><label>底料状态</label><select data-key="status">${selectOptions(OPTIONS.base_status, m.status || "研发调试")}</select></div>
      <div class="field"><label>关联使用菜品</label><select data-key="linked_dish_id"><option value="">（无）</option>${LOOKUP_DISH.map(d => `<option value="${d.id}" ${Number(m.linked_dish_id) === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      <div class="field full"><label>熬制备注（工艺/火候/时长/过滤/保存/保质期）</label><textarea data-key="batch_note">${esc(m.batch_note ?? "")}</textarea></div>
      <div class="field full" style="background:#fcf7f2;border-radius:8px;padding:10px">
        <label>自动计算结果</label>
        <div>单位成本(元/g或元/ml)：<b id="base-unit-cost">${fmt(m["单位成本(元/g或元/ml)"], 6)}</b> ｜ 子表单合计参考：<b id="base-sub-total">${fmt(m["__sub_total"], 2)}</b> 元</div>
      </div>
    </div>
    <div class="subform">
      <h4>本锅-原料投料明细</h4>
      <div id="base-subs">${subs.map(baseSubRow).join("")}</div>
      <button class="add-sub" type="button" id="add-base-sub">＋ 添加投料</button>
      <button class="btn-ghost" type="button" id="sum-base-sub" style="margin-left:8px">∑ 汇总子项成本→整锅总成本</button>
    </div>`;
  attachUploads(body);
  const subsBox = body.querySelector("#base-subs");
  const wireSub = (row) => {
    row.querySelector(".sub-del").onclick = () => row.remove();
    row.querySelectorAll("select,input").forEach(i => i.oninput = () => recalcBaseSub(row));
    recalcBaseSub(row);
  };
  subsBox.querySelectorAll(".subrow").forEach(wireSub);
  body.querySelector("#add-base-sub").onclick = () => { const row = elFrom(baseSubRow({})); subsBox.appendChild(row); wireSub(row); };
  body.querySelector("#sum-base-sub").onclick = () => {
    let sum = 0;
    subsBox.querySelectorAll(".subrow").forEach(r => { recalcBaseSub(r); sum += Number(r.querySelector('[data-f="cost"]').value || 0); });
    body.querySelector('[data-key="total_cost"]').value = sum.toFixed(2);
    updateBaseUnitCost();
    toast("已汇总子项成本");
  };
  const updateBaseUnitCost = () => {
    const tc = Number(body.querySelector('[data-key="total_cost"]').value || 0);
    const o = Number(body.querySelector('[data-key="total_output"]').value || 0);
    body.querySelector("#base-unit-cost").textContent = o > 0 ? (tc / o).toFixed(6) : "0";
  };
  body.querySelectorAll('[data-key="total_cost"],[data-key="total_output"]').forEach(i => i.oninput = updateBaseUnitCost);
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["name", "photo", "category", "batch_date",
      "total_output", "batch_note", "total_cost", "shelf_life_cold", "status", "linked_dish_id"]);
    payload.subs = Array.from(subsBox.querySelectorAll(".subrow")).map(r => ({
      ingredient_id: r.querySelector('[data-f="ingredient_id"]').value || null,
      input_weight: r.querySelector('[data-f="input_weight"]').value,
      note: r.querySelector('[data-f="note"]').value,
    }));
    if (rec) await sendJSON(`/api/base/${rec.main.id}`, "PUT", payload);
    else await sendJSON("/api/base", "POST", payload);
    closeModal(); await refreshLookups(); render(); toast("已保存");
  };
}

// ---------------- 菜品 新建/编辑 ----------------
function dishSubRow(s) {
  s = s || {};
  const stype = s.source_type || "普通原料";
  const ingOpts = `<option value="">选择原料</option>` + LOOKUP_ING.map(i => `<option value="${i.id}" ${Number(s.ingredient_id) === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("");
  const baseOpts = `<option value="">选择底料批次</option>` + LOOKUP_BASE.map(b => `<option value="${b.id}" ${Number(s.base_id) === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("");
  return `<div class="subrow dish-sub" data-sub="dish">
    <select data-f="source_type" class="src-type">${OPTIONS.dish_source_types.map(t => `<option ${t === stype ? "selected" : ""}>${t}</option>`).join("")}</select>
    <span class="src-ing ${stype === "汤底酱料底料" ? "hidden" : ""}"><select data-f="ingredient_id">${ingOpts}</select></span>
    <span class="src-base ${stype === "普通原料" ? "hidden" : ""}"><select data-f="base_id">${baseOpts}</select></span>
    <input data-f="amount" type="number" step="0.1" value="${esc(s.amount ?? "")}" placeholder="取用量">
    <select data-f="unit">${(OPTIONS.sub_units || []).map(u => `<option ${u === s.unit ? "selected" : ""}>${u}</option>`).join("")}</select>
    <input class="calc" data-f="price" readonly value="" title="拉取的单价">
    <input class="calc" data-f="cost" readonly value="" title="该单项单份成本">
    <input data-f="display_text" value="${esc(s.display_text ?? "")}" placeholder="后厨展示">
    <button class="sub-del" type="button">✕</button>
  </div>`;
}
function recalcDishSub(row) {
  const stype = row.querySelector('[data-f="source_type"]').value;
  const unit = row.querySelector('[data-f="unit"]').value;
  const amt = Number(row.querySelector('[data-f="amount"]').value || 0);
  const ingCell = row.querySelector('.src-ing');
  const baseCell = row.querySelector('.src-base');
  let per, pulled;
  if (stype === "汤底酱料底料") {
    ingCell.classList.add("hidden"); baseCell.classList.remove("hidden");
    const bid = Number(row.querySelector('[data-f="base_id"]').value);
    per = baseUnitCost(bid); pulled = per;
  } else {
    ingCell.classList.remove("hidden"); baseCell.classList.add("hidden");
    const ing = Number(row.querySelector('[data-f="ingredient_id"]').value);
    const price = ingPrice(ing);
    per = (unit === "只") ? price : price / 1000; pulled = price;
  }
  row.querySelector('[data-f="price"]').value = (pulled == null ? "" : Number(pulled).toFixed(4));
  row.querySelector('[data-f="cost"]').value = (amt * per).toFixed(4);
}
function openDishModal(rec) {
  const m = rec ? rec.main : {};
  const subs = rec ? rec.subs : [];
  const body = openModal(rec ? "编辑菜品" : "新建菜品");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>菜品名称 *</label><input data-key="name" value="${esc(m.name ?? "")}"></div>
      <div class="field"><label>菜品类别</label><select data-key="category">${selectOptions(OPTIONS.dish_categories, m.category)}</select></div>
      ${imgField("菜品照片", m.photo, "photo")}
      <div class="field"><label>建议售价(元)</label><input data-key="suggested_price" type="number" step="0.01" value="${esc(m.suggested_price ?? "")}"></div>
      <div class="field"><label>预估食材成本(元) · 自动汇总</label><input data-key="est_cost" class="ro" readonly value="${fmt(m.est_cost)}"></div>
      <div class="field"><label>出品份量</label><input data-key="portion" value="${esc(m.portion ?? "")}"></div>
      <div class="field"><label>煮制/制作总时长(分钟)</label><input data-key="cook_time" type="number" step="1" value="${esc(m.cook_time ?? "")}"></div>
      <div class="field"><label>研发状态</label><select data-key="status">${selectOptions(OPTIONS.dish_status, m.status || "研发中")}</select></div>
      <div class="field full"><label>风味简介</label><textarea data-key="flavor">${esc(m.flavor ?? "")}</textarea></div>
      <div class="field full"><label>测试反馈</label><textarea data-key="test_feedback">${esc(m.test_feedback ?? "")}</textarea></div>
      <div class="field full"><label>后续调整步骤</label><textarea data-key="adjustments">${esc(m.adjustments ?? "")}</textarea></div>
      <div class="field full"><label>SOP-预处理要求（食材预处理/解冻/清洗/预煮标准）</label><textarea data-key="sop_prep" class="sop-area">${esc(m.sop_prep ?? "")}</textarea></div>
      <div class="field full"><label>SOP-分步出品流程（步骤/温度/克重/时间顺序）</label><textarea data-key="sop_steps" class="sop-area">${esc(m.sop_steps ?? "")}</textarea></div>
      <div class="field full"><label>SOP-出品摆盘&出餐标准（容器/摆盘/点缀/温度/时限）</label><textarea data-key="sop_plate" class="sop-area">${esc(m.sop_plate ?? "")}</textarea></div>
      <div class="field full"><label>SOP-注意事项&禁忌（风险点/存放/回热/禁止操作）</label><textarea data-key="sop_notice" class="sop-area">${esc(m.sop_notice ?? "")}</textarea></div>
      ${multiChecks(OPTIONS.position_tags, m.position_tags, "产品定位标签")}
      ${multiChecks(OPTIONS.scenes, m.scenes, "适用场景")}
    </div>
    <div class="subform">
      <h4>菜品食材明细（支持普通原料 / 引用汤底酱料底料，单份成本自动计算）</h4>
      <div id="dish-subs">${subs.map(dishSubRow).join("")}</div>
      <button class="add-sub" type="button" id="add-dish-sub">＋ 添加食材/底料</button>
    </div>`;
  attachUploads(body);
  const subsBox = body.querySelector("#dish-subs");
  const wireSub = (row) => {
    row.querySelector(".sub-del").onclick = () => row.remove();
    row.querySelectorAll("select,input").forEach(i => i.oninput = () => recalcDishSub(row));
    recalcDishSub(row);
  };
  subsBox.querySelectorAll(".subrow").forEach(wireSub);
  body.querySelector("#add-dish-sub").onclick = () => {
    const row = elFrom(dishSubRow({})); subsBox.appendChild(row); wireSub(row);
  };
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["name", "photo", "category", "flavor", "suggested_price",
      "est_cost", "portion", "cook_time", "test_feedback", "adjustments", "sop_prep",
      "sop_steps", "sop_plate", "sop_notice", "status"]);
    payload.position_tags = readMulti(body, "产品定位标签");
    payload.scenes = readMulti(body, "适用场景");
    payload.subs = Array.from(subsBox.querySelectorAll(".subrow")).map(r => ({
      source_type: r.querySelector('[data-f="source_type"]').value,
      ingredient_id: r.querySelector('[data-f="ingredient_id"]').value || null,
      base_id: r.querySelector('[data-f="base_id"]').value || null,
      amount: r.querySelector('[data-f="amount"]').value,
      unit: r.querySelector('[data-f="unit"]').value,
      display_text: r.querySelector('[data-f="display_text"]').value,
      note: "",
    }));
    if (rec) await sendJSON(`/api/dishes/${rec.main.id}`, "PUT", payload);
    else await sendJSON("/api/dishes", "POST", payload);
    closeModal(); await refreshLookups(); render(); toast("已保存");
  };
}

// ---------------- 原料 新建/编辑 ----------------
function openIngModal(rec) {
  const m = rec || {};
  const body = openModal(rec ? "编辑原料" : "新建原料");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>原料名称 *</label><input data-key="name" value="${esc(m.name ?? "")}"></div>
      <div class="field"><label>原料分类</label><select data-key="category">${selectOptions(OPTIONS.ing_categories, m.category)}</select></div>
      <div class="field"><label>库存单位</label><select data-key="unit">${selectOptions(OPTIONS.ing_units, m.unit)}</select></div>
      <div class="field"><label>供应商</label><input data-key="supplier" value="${esc(m.supplier ?? "")}"></div>
      <div class="field"><label>存放位置</label><select data-key="storage">${selectOptions(OPTIONS.ing_storage, m.storage)}</select></div>
      <div class="field"><label>标准采购单价(元/kg)</label><input data-key="std_price" type="number" step="0.01" value="${esc(m.std_price ?? "")}"></div>
      <div class="field"><label>当前实际库存(账面数)</label><input data-key="book_stock" type="number" step="0.01" value="${esc(m.book_stock ?? "")}"></div>
      <div class="field"><label>盘点-现场实盘数量</label><input data-key="physical_stock" type="number" step="0.01" value="${esc(m.physical_stock ?? "")}"></div>
      <div class="field"><label>安全库存红线</label><input data-key="safety_line" type="number" step="0.01" value="${esc(m.safety_line ?? "")}"></div>
      <div class="field"><label>本批次每公斤约只数</label><input data-key="per_kg_count" type="number" step="0.1" value="${esc(m.per_kg_count ?? "")}"></div>
      <div class="field"><label>批次生产日期</label><input data-key="batch_prod_date" type="date" value="${esc(m.batch_prod_date ?? "")}"></div>
      <div class="field"><label>官方保质期(天数)</label><input data-key="shelf_life_days" type="number" step="1" value="${esc(m.shelf_life_days ?? "")}"></div>
      <div class="field"><label>最佳使用截止日</label><input data-key="best_before" type="date" value="${esc(m.best_before ?? "")}"></div>
      <div class="field"><label>过期截止日</label><input data-key="expire_date" type="date" value="${esc(m.expire_date ?? "")}"></div>
      <div class="field"><label>临期预警提前天数</label><input data-key="exp_warn_days" type="number" step="1" value="${esc(m.exp_warn_days ?? "")}"></div>
      <div class="field"><label>关联菜品档案</label><select data-key="linked_dish_id"><option value="">（无）</option>${LOOKUP_DISH.map(d => `<option value="${d.id}" ${Number(m.linked_dish_id) === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      ${imgField("批次采购票据", m.ticket_photo, "ticket_photo")}
      <div class="field full"><label>盘点-差异备注</label><textarea data-key="diff_note_ph"></textarea></div>
      <div class="field full" style="background:#fcf7f2;border-radius:8px;padding:10px">
        <label>自动计算结果</label>
        <div>盘点-库存差异：<b>${fmt(m["盘点-库存差异"])}</b> ｜ 库存预警：${esc(m["库存预警状态"] || "—")}</div>
        <div>保质期状态：<b>${esc(m["保质期状态"] || "—")}</b> ｜ 估算单只/份成本：<b>${fmt(m["估算单只/份成本"], 3)}</b> 元</div>
      </div>
    </div>`;
  body.querySelector('[data-key="diff_note_ph"]').value = m["盘点-差异备注"] || "";
  attachUploads(body);
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["name", "photo", "category", "unit", "supplier", "storage",
      "std_price", "book_stock", "physical_stock", "safety_line", "per_kg_count", "batch_prod_date",
      "shelf_life_days", "best_before", "expire_date", "exp_warn_days", "linked_dish_id", "ticket_photo"]);
    payload["盘点-差异备注"] = body.querySelector('[data-key="diff_note_ph"]').value;
    if (rec) await sendJSON(`/api/ingredients/${rec.id}`, "PUT", payload);
    else await sendJSON("/api/ingredients", "POST", payload);
    closeModal(); await refreshLookups(); render(); toast("已保存");
  };
}

// ---------------- 销售 新建/编辑 ----------------
function saleSubRow(s) {
  s = s || {};
  return `<div class="subrow" data-sub="sale" style="grid-template-columns:2fr 1fr auto">
    <select data-f="dish_id">${`<option value="">选择菜品</option>` + LOOKUP_DISH.map(d => `<option value="${d.id}" ${Number(s.dish_id) === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <input data-f="qty" type="number" step="1" value="${esc(s.qty ?? "")}" placeholder="售卖份数">
    <button class="sub-del" type="button">✕</button>
  </div>`;
}
function openSaleModal(rec) {
  const m = rec ? rec.main : {};
  const subs = rec ? rec.subs : [];
  const body = openModal(rec ? "编辑销售日报" : "新建销售日报");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>营业日期 *</label><input data-key="date" type="date" value="${esc(m.date ?? "")}"></div>
      <div class="field full"><label>备注（营业情况）</label><textarea data-key="note">${esc(m.note ?? "")}</textarea></div>
    </div>
    <div class="subform">
      <h4>当日菜品销售明细</h4>
      <div id="sale-subs">${subs.map(saleSubRow).join("")}</div>
      <button class="add-sub" type="button" id="add-sale-sub">＋ 添加销售菜品</button>
    </div>`;
  const box = body.querySelector("#sale-subs");
  const wire = (row) => { row.querySelector(".sub-del").onclick = () => row.remove(); };
  box.querySelectorAll(".subrow").forEach(wire);
  body.querySelector("#add-sale-sub").onclick = () => { const r = elFrom(saleSubRow({})); box.appendChild(r); wire(r); };
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["date", "note"]);
    payload.subs = Array.from(box.querySelectorAll(".subrow")).map(r => ({
      dish_id: r.querySelector('[data-f="dish_id"]').value || null,
      qty: r.querySelector('[data-f="qty"]').value,
    }));
    if (rec) await sendJSON(`/api/sales/${rec.main.id}`, "PUT", payload);
    else await sendJSON("/api/sales", "POST", payload);
    closeModal(); await refreshLookups(); render(); toast("已保存");
  };
}

// ---------------- 销售 Excel 批量导入 ----------------
function dishNameById(id) {
  const d = LOOKUP_DISH.find(x => x.id === Number(id));
  return d ? d.name : "未知菜品";
}
function openSaleImportModal() {
  if (offlineGuard()) return;
  const body = openModal("上传Excel录入销售日报");
  document.getElementById("modal-save").style.display = "none";
  body.innerHTML = `
    <div class="import-box">
      <p class="hint">按模板填写 Excel（.xlsx）后上传：系统按「营业日期」自动分组，逐日生成销售日报，并按<b>菜品名称</b>匹配系统菜品档案自动录入售卖份数。</p>
      <div class="import-row">
        <a class="btn-export" href="${API}/api/import/sales/template" target="_blank" rel="noopener">⬇ 下载导入模板</a>
        <label class="btn-primary" style="background:#27ae60;cursor:pointer">📂 选择Excel文件
          <input type="file" id="sale-import-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none">
        </label>
        <label class="chk"><input type="checkbox" id="sale-import-overwrite"> 覆盖已存在同日期记录</label>
      </div>
      <div id="sale-import-msg" class="import-msg"></div>
      <div id="sale-import-preview"></div>
      <div id="sale-import-actions" style="display:none;margin-top:12px">
        <button class="btn-primary" id="sale-import-confirm" style="background:#27ae60">✅ 确认导入</button>
        <button class="btn-ghost" id="sale-import-cancel" type="button">取消</button>
      </div>
    </div>`;
  const fileInp = body.querySelector("#sale-import-file");
  const msg = body.querySelector("#sale-import-msg");
  const prev = body.querySelector("#sale-import-preview");
  const actions = body.querySelector("#sale-import-actions");

  fileInp.onchange = async () => {
    if (!fileInp.files.length) return;
    const fd = new FormData();
    fd.append("file", fileInp.files[0]);
    msg.innerHTML = "解析中…"; prev.innerHTML = ""; actions.style.display = "none";
    try {
      const r = await fetch(API + "/api/import/sales?preview=1", { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) { msg.innerHTML = `<span class="err">${esc(j.error)}</span>`; return; }
      msg.innerHTML = `解析完成：共 <b>${j.summary.rows}</b> 行 → 可生成 <b>${j.summary.records}</b> 条销售日报（含 <b>${j.summary.items}</b> 条菜品销量）。`;
      prev.innerHTML = renderImportPreview(j);
      actions.style.display = "block";
    } catch (e) {
      msg.innerHTML = `<span class="err">解析失败：${esc(e.message)}</span>`;
    }
  };

  body.querySelector("#sale-import-cancel").onclick = () => { closeModal(); document.getElementById("modal-save").style.display = ""; };
  body.querySelector("#sale-import-confirm").onclick = async () => {
    if (!fileInp.files.length) { toast("请先选择文件"); return; }
    const fd = new FormData();
    fd.append("file", fileInp.files[0]);
    if (body.querySelector("#sale-import-overwrite").checked) fd.append("overwrite", "1");
    const btn = body.querySelector("#sale-import-confirm");
    btn.disabled = true; btn.textContent = "导入中…";
    try {
      const r = await fetch(API + "/api/import/sales", { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) { msg.innerHTML = `<span class="err">${esc(j.error)}</span>`; return; }
      let html = `<span class="ok">导入完成：成功 <b>${j.imported}</b> 条，跳过 <b>${j.skipped}</b> 条。</span>`;
      if (j.warnings && j.warnings.length) {
        html += `<div class="warn-list"><div class="warn-title">提示 / 警告：</div>` +
          j.warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join("") + `</div>`;
      }
      msg.innerHTML = html;
      prev.innerHTML = ""; actions.style.display = "none";
      await refreshLookups(); render();
      toast("Excel 销售数据已录入");
    } catch (e) {
      msg.innerHTML = `<span class="err">导入失败：${esc(e.message)}</span>`;
    } finally {
      btn.disabled = false; btn.textContent = "✅ 确认导入";
    }
  };
}
function renderImportPreview(j) {
  if (!j.records.length) return `<div class="empty">没有可导入的销售数据</div>`;
  const rows = [];
  j.records.forEach(rec => {
    const badge = rec.exists
      ? `<span class="badge warn">已存在·将跳过</span>`
      : `<span class="badge ok">新增</span>`;
    if (!rec.items.length) {
      rows.push(`<tr><td>${esc(rec.date)}</td><td colspan="2" class="muted">（仅备注/无菜品行）</td><td>${badge} ${esc(rec.note || "")}</td></tr>`);
      return;
    }
    rec.items.forEach((it, idx) => {
      rows.push(`<tr>
        <td>${idx === 0 ? esc(rec.date) : ""}</td>
        <td>${esc(dishNameById(it.dish_id))}</td>
        <td>${fmt(it.qty, 0)}</td>
        <td>${idx === 0 ? badge + " " + esc(rec.note || "") : ""}</td>
      </tr>`);
    });
  });
  let unmatched = "";
  if (j.summary.unmatched && j.summary.unmatched.length) {
    unmatched = `<div class="warn-list"><div class="warn-title">以下菜品未匹配系统档案，将被忽略：</div>` +
      j.summary.unmatched.map(n => `<div>⚠ ${esc(n)}</div>`).join("") + `</div>`;
  }
  return `<div class="tablewrap"><table>
    <tr><th>营业日期</th><th>菜品</th><th>售卖份数</th><th>状态 / 备注</th></tr>
    ${rows.join("")}
  </table></div>${unmatched}`;
}

// ---------------- 出入库流水 模态 ----------------
function openFlowModal() {
  const body = openModal("新增出入库流水");
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>关联原料 *</label><select data-key="ingredient_id"><option value="">选择原料</option>${LOOKUP_ING.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></div>
      <div class="field"><label>操作时间</label><input data-key="op_time" type="datetime-local"></div>
      <div class="field"><label>操作类型</label><select data-key="op_type">${selectOptions(OPTIONS.flow_types, "采购入库")}</select></div>
      <div class="field"><label>变动数量(入库+,出库/报废-)</label><input data-key="qty" type="number" step="0.01"></div>
      <div class="field"><label>本次采购单价(元/kg)</label><input data-key="purchase_price" type="number" step="0.01"></div>
      <div class="field"><label>本次操作总只数(虾贝类)</label><input data-key="total_count" type="number" step="1"></div>
      <div class="field"><label>对应批次生产日期</label><input data-key="batch_prod_date" type="date"></div>
      <div class="field"><label>对应批次过期截止日</label><input data-key="batch_expire_date" type="date"></div>
      <div class="field"><label>经手人</label><input data-key="operator"></div>
      ${imgField("本次入库票据照片", "", "ticket_photo")}
      <div class="field full"><label>备注</label><textarea data-key="note"></textarea></div>
    </div>`;
  attachUploads(body);
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["ingredient_id", "op_time", "op_type", "qty", "purchase_price",
      "total_count", "batch_prod_date", "batch_expire_date", "operator", "ticket_photo", "note"]);
    await sendJSON("/api/flow", "POST", payload);
    closeModal(); await refreshLookups(); render(); toast("已登记，账面库存已自动更新");
  };
}

// ---------------- 通用表单收集 ----------------
function collectForm(body, keys) {
  const o = {};
  keys.forEach(k => {
    const inp = body.querySelector(`[data-key="${k}"]`);
    o[k] = inp ? inp.value : "";
  });
  return o;
}

// ---------------- 操作流程 ----------------
function renderGuide(main) {
  const steps = [
    ["汤底酱料大锅成本", [
      "新建底料记录，录入熬制批次，子表单录入本锅全部投料（自动计算各项原料成本）",
      "点「∑ 汇总子项成本」填入【整锅物料总成本】，再录入熬制后实际产出总重量",
      "系统自动生成单位成本 元/g｜元/ml；状态改为【批次完成】，菜品即可引用",
    ]],
    ["菜品研发&成本", [
      "菜品子表单选择来源类型：普通原料 / 汤底酱料底料",
      "填写单份取用数量，自动生成分项成本（含分摊的底料单位成本）",
      "汇总全部分项成本自动回写【预估食材成本】",
      "填写完整 SOP 四组多行字段：预处理 / 分步出品 / 摆盘标准 / 注意事项",
      "录入售价，自动生成毛利率、毛利风险标记；上线设研发状态=正式上线",
    ]],
    ["✨ SOP 输出 PDF（iPad）", [
      "打开视图【👉 菜品完整SOP导出视图】，按需筛选全部菜品 / 单个菜品",
      "麦芽精酿 右上角：导出Excel",
      "iPad 用 WPS / Numbers 打开导出文件",
      "文件 → 导出 → 导出为 PDF，保存即得到 PDF 版出品 SOP，可打印、下发后厨、归档",
    ]],
    ["每日开店点检", [
      "查看「今日补货清单」安排采购",
      "查看「临期&过期食材」处理临期、过期原料",
    ]],
    ["进货入库", [
      "维护原料档案单价、批次保质期；虾填写本批次每公斤约只数",
      "出入库流水新增：采购入库，上传票据照片（账面库存自动增减）",
    ]],
    ["每日打烊", [
      "新建每日销售日报，录入营收；子表单录入各菜品售卖份数",
      "对照菜品食材明细计算理论原料消耗",
      "出入库流水新增：生产领用出库；虾填写本次操作总只数",
    ]],
    ["每周仓储盘点", [
      "打开「仓储盘点导出视图」，按需筛选分类，导出Excel盘点表",
      "现场清点实物，填写：盘点-现场实盘数量、盘点-差异备注",
      "打开「盘点差异视图」快速定位账实不符物料",
      "出入库流水新增：操作类型=盘点修正，修正账面库存",
      "清空盘点-现场实盘数量、盘点-差异备注，供下次盘点",
    ]],
    ["月底对账", [
      "打开「采购票据对账视图」核对送货单据，核算食材成本",
    ]],
  ];
  main.innerHTML = steps.map(([t, ss]) => `
    <div class="guide-section"><h2>${t}</h2>${ss.map((s, i) =>
      `<div class="guide-step"><div class="step-no">${i + 1}</div><div class="step-txt">${esc(s)}</div></div>`).join("")}</div>
  `).join("");
}

// ---------------- 操作备忘录（内置，Markdown 渲染，可编辑） ----------------
async function renderMemo(main) {
  main.innerHTML = `<div class="toolbar">
      <span class="memo-updated" id="memo-updated"></span>
      <button class="btn-primary" id="btn-edit-memo" style="margin-left:auto">✏️ 编辑备忘录</button>
    </div>
    <div id="memo-view" class="memo-view"><div class="empty">加载中…</div></div>`;
  const view = main.querySelector("#memo-view");
  const upd = main.querySelector("#memo-updated");
  try {
    const j = await getJSON("/api/memo");
    view.innerHTML = j.html || `<div class="empty">备忘录为空，点击右上角「编辑备忘录」开始记录</div>`;
    upd.textContent = j.updated_at ? "最近更新：" + j.updated_at : "";
  } catch (e) {
    view.innerHTML = `<div class="empty">加载失败</div>`;
  }
  const editBtn = main.querySelector("#btn-edit-memo");
  if (window.__OFFLINE__ && editBtn) editBtn.style.display = "none";
  main.querySelector("#btn-edit-memo").onclick = openMemoEdit;
}
async function openMemoEdit() {
  if (offlineGuard()) return;
  const cur = await getJSON("/api/memo");
  const body = openModal("编辑操作备忘录（Markdown）");
  body.innerHTML = `
    <p class="hint">支持 Markdown：<code># 标题</code> / <code>## 小标题</code> / <code>1. 序号</code> / <code>- 项目符号</code> / <code>&gt; 引用</code>。保存后 iPad 端刷新即可看到最新内容。</p>
    <textarea data-key="content" class="memo-edit" placeholder="在此编写操作备忘录…">${esc(cur.content || "")}</textarea>`;
  document.getElementById("modal-save").onclick = async () => {
    const payload = { content: body.querySelector('[data-key="content"]').value };
    await fetch(API + "/api/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    closeModal();
    toast("备忘录已保存");
    render();
  };
}

// ---------------- 打印 / PDF 模板中心 ----------------
function printModuleName(mod) { return mod === "dish" ? "菜品" : mod === "base" ? "底料" : "记录"; }

async function batchPrint(mod) {
  let ids = [];
  if (mod === "base") {
    const data = await getJSON("/api/base");
    ids = data.map(d => d.main.id);
  } else if (mod === "dish") {
    const data = await getJSON("/api/dishes");
    let recs = data.map(d => d.main).filter(r => r.status === "正式上线");
    if (STATE.sopFilter) recs = recs.filter(r => r.name === STATE.sopFilter);
    ids = recs.map(r => r.id);
  }
  if (!ids.length) { toast("没有可打印的记录"); return; }
  openBatchPrintModal(mod, ids);
}

async function openBatchPrintModal(mod, ids) {
  const list = await getJSON(`/api/templates?module=${mod}`);
  if (!list.length) { toast("请先创建 PDF 模板"); return; }
  let sel = list[0].id;
  const body = openModal(`批量打印 ${printModuleName(mod)} SOP（共 ${ids.length} 份）`);
  body.innerHTML = `<div class="field full"><label>选择 PDF 模板</label><select id="print-tpl">${list.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>`;
  body.querySelector("#print-tpl").onchange = (e) => sel = e.target.value;
  document.getElementById("modal-save").textContent = "下载 ZIP 包";
  document.getElementById("modal-save").onclick = () => {
    window.open(`/api/print/batch/${mod}?ids=${ids.join(",")}&tpl=${sel}`, "_blank");
    closeModal();
  };
}

async function openPrintModal(mod, rid) {
  const list = await getJSON(`/api/templates?module=${mod}`);
  if (!list.length) { toast("请先创建 PDF 模板"); return; }
  let sel = list[0].id;
  const body = openModal(`${printModuleName(mod)} SOP 打印`);
  const saveBtn = document.getElementById("modal-save");

  // 打印选项层（上一层界面）：选模板 + 预览入口 + 下载 PDF
  function bindOptions() {
    body.innerHTML = `
      <div class="field full"><label>选择 PDF 模板</label><select id="print-tpl">${list.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
      <div class="field full"><button class="btn-primary" id="print-preview-btn">👁 预览 HTML</button></div>`;
    const tplSel = body.querySelector("#print-tpl");
    tplSel.value = sel;
    tplSel.onchange = () => { sel = tplSel.value; };
    body.querySelector("#print-preview-btn").onclick = showPreview;
    saveBtn.style.display = "";
    saveBtn.textContent = "下载 PDF";
    saveBtn.onclick = () => {
      window.open(`/api/print/${mod}/${rid}/pdf?tpl=${sel}`, "_blank");
      closeModal();
    };
  }

  // 预览层：内嵌 iframe，仅提供「返回」回到打印选项层（不跳主界面）
  function showPreview() {
    body.innerHTML = `
      <div class="print-prev-head">
        <button class="btn-primary" id="print-back">← 返回</button>
        <a class="btn-export" href="/api/print/${mod}/${rid}/pdf?tpl=${sel}" target="_blank" rel="noopener">⬇ 下载 PDF</a>
      </div>
      <iframe class="print-prev-frame" src="/api/print/${mod}/${rid}?tpl=${sel}&embed=1"></iframe>`;
    saveBtn.style.display = "none";
    body.querySelector("#print-back").onclick = bindOptions;
  }

  bindOptions();
}

async function renderTplView(main) {
  const data = await getJSON("/api/templates");
  const cards = (m) => data.filter(t => t.module === m).map(t => `
    <div class="tpl-card">
      <span class="tpl-name">${esc(t.name)}</span>
      <span class="tag">${m === "dish" ? "菜品" : "底料"}</span>
      <div class="tpl-actions">
        <button class="btn-sm btn-edit" data-fn="edit" data-id="${t.id}">编辑源码</button>
        <button class="btn-sm btn-del" data-fn="del" data-id="${t.id}">删除</button>
      </div>
    </div>`).join("") || `<p class="muted">暂无${m === "dish" ? "菜品" : "底料"}模板</p>`;
  main.innerHTML = `
    <div class="toolbar"><button class="btn-primary" id="btn-new-tpl">＋ 新建 PDF 模板</button></div>
    <div class="guide-section"><h2>菜品模板（用于菜品研发档案 → 打印菜品 SOP）</h2><div class="tpl-list">${cards("dish")}</div></div>
    <div class="guide-section"><h2>底料模板（用于汤底/酱料底成本台账 → 打印底料熬制 SOP）</h2><div class="tpl-list">${cards("base")}</div></div>`;
  main.querySelector("#btn-new-tpl").onclick = () => openTemplateModal(null);
  main.querySelectorAll("button[data-fn='edit']").forEach(b => b.onclick = () => openTemplateModal(Number(b.dataset.id)));
  main.querySelectorAll("button[data-fn='del']").forEach(b => b.onclick = async () => {
    if (confirm("确认删除该模板？")) {
      await sendJSON(`/api/templates/${b.dataset.id}`, "DELETE");
      renderTplView(main); toast("已删除");
    }
  });
}

async function openTemplateModal(tid) {
  let rec = null;
  if (tid) { const all = await getJSON("/api/templates"); rec = all.find(t => t.id === tid); }
  const body = openModal(rec ? "编辑 PDF 模板" : "新建 PDF 模板");
  const modules = [{ v: "dish", n: "菜品研发档案" }, { v: "base", n: "汤底/酱料底成本台账" }];
  body.innerHTML = `
    <div class="formgrid">
      <div class="field"><label>模板名称</label><input data-key="name" value="${esc(rec?.name || "")}"></div>
      <div class="field"><label>适用模块</label><select data-key="module">${modules.map(o => `<option value="${o.v}" ${rec?.module === o.v ? "selected" : ""}>${o.n}</option>`).join("")}</select></div>
      <div class="field full"><label>模板源码（变量 {{字段名}}，子表单用 {{#子表单}}...{{/子表单}}，判断用 {{#if (eq 字段 "值")}}...{{/if}}）</label>
        <textarea data-key="source" class="sop-area" style="min-height:320px;font-family:monospace">${esc(rec?.source || "")}</textarea>
      </div>
    </div>`;
  document.getElementById("modal-save").onclick = async () => {
    const payload = collectForm(body, ["name", "module", "source"]);
    if (tid) await sendJSON(`/api/templates/${tid}`, "PUT", payload);
    else await sendJSON("/api/templates", "POST", payload);
    closeModal(); renderTplView(document.getElementById("main")); toast("已保存");
  };
}

init();
