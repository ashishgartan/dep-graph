// ── UI MODULE ─────────────────────────────────────────────────────────
// Sidebar rendering, info panel, toast notifications, stats bar,
// and general DOM utility functions.

import { shortName } from "./parser.js";

let _toastTimer = null;

export function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

export function updateStats(nodes, edges, circularPairs) {
  const fEl = document.getElementById("stat-files");
  const dEl = document.getElementById("stat-deps");
  const cEl = document.getElementById("stat-circular");
  if (fEl) fEl.textContent = nodes.length;
  if (dEl) dEl.textContent = edges.length;
  if (cEl) cEl.textContent = circularPairs.size;
}

export function renderSidebar(graphData, onNodeClick) {
  const list = document.getElementById("file-list");
  if (!list) return;

  const sorted = [...graphData.nodes].sort((a, b) => {
    const ac = graphData.edges.filter(
      (e) =>
        (e.source.id || e.source) === a.id || (e.target.id || e.target) === a.id
    ).length;
    const bc = graphData.edges.filter(
      (e) =>
        (e.source.id || e.source) === b.id || (e.target.id || e.target) === b.id
    ).length;
    return bc - ac;
  });

  list.innerHTML = sorted
    .map((n) => {
      const count = graphData.edges.filter(
        (e) =>
          (e.source.id || e.source) === n.id ||
          (e.target.id || e.target) === n.id
      ).length;
      return `<div class="file-item" data-id="${n.id}" title="${n.id}">
        <div class="file-dot" style="background:${n.color}"></div>
        <span class="file-name">${shortName(n.id)}</span>
        <span class="file-count">${count}</span>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".file-item").forEach((el) => {
    el.addEventListener("click", () => onNodeClick(el.dataset.id));
  });
}

export function highlightSidebar(id) {
  document.querySelectorAll(".file-item").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === id);
  });
  const sel = document.querySelector(`.file-item[data-id="${CSS.escape(id)}"]`);
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

export function updateInfoPanel(node, graphData, circularPairs) {
  const panel = document.getElementById("info-panel");
  if (!panel) return;

  if (!node) {
    panel.innerHTML = `<div class="info-title">Details</div><div class="info-empty">Click a node to inspect</div>`;
    return;
  }

  const imports = graphData.edges.filter(
    (e) => (e.source.id || e.source) === node.id
  );
  const importedBy = graphData.edges.filter(
    (e) => (e.target.id || e.target) === node.id
  );
  const isCircular = circularPairs.has(node.id);

  const typeColors = {
    import: "#7c6aff",
    require: "#34d399",
    style: "#f472b6",
    data: "#facc15",
    asset: "#fb923c",
    query: "#e879f9",
  };

  panel.innerHTML = `
    <div class="info-title">Details</div>
    <div class="info-filename">${node.id}</div>
    ${
      isCircular ? `<div class="info-circular">⚠ Circular dependency</div>` : ""
    }
    <div class="info-row"><span>References</span><b>${imports.length}</b></div>
    <div class="info-row"><span>Referenced by</span><b>${
      importedBy.length
    }</b></div>
    ${
      imports.length
        ? `<div class="info-imports">
        ${imports
          .slice(0, 10)
          .map((e) => {
            const t = e.target.id || e.target;
            const ty = e.type || "import";
            return `<div class="info-import-item">
              <span class="import-type-badge" style="color:${
                typeColors[ty] || "#aaa"
              }">${ty}</span>
              ${shortName(t)}
            </div>`;
          })
          .join("")}
        ${
          imports.length > 10
            ? `<div class="info-import-item info-more">+${
                imports.length - 10
              } more</div>`
            : ""
        }
      </div>`
        : ""
    }
  `;
}

export function showGraphUI() {
  document.getElementById("dropzone").style.display = "none";
  document.getElementById("controls").style.display = "flex";
  document.getElementById("legend").style.display = "flex";
  document.getElementById("btn-layout").style.display = "flex";
  document.getElementById("btn-new").style.display = "flex";
  document.getElementById("header-stats").style.display = "flex";
  document.getElementById("view-switcher").classList.add("visible");
}

export function hideGraphUI() {
  document.getElementById("dropzone").style.display = "flex";
  document.getElementById("controls").style.display = "none";
  document.getElementById("legend").style.display = "none";
  document.getElementById("btn-layout").style.display = "none";
  document.getElementById("btn-new").style.display = "none";
  document.getElementById("header-stats").style.display = "none";
  document.getElementById("view-switcher").classList.remove("visible");
  document.getElementById("circular-badge").style.display = "none";
  document.getElementById(
    "file-list"
  ).innerHTML = `<div class="sidebar-empty">No project loaded</div>`;
  document.getElementById(
    "info-panel"
  ).innerHTML = `<div class="info-title">Details</div><div class="info-empty">Click a node to inspect</div>`;
}

export function showCircularBadge(count) {
  const badge = document.getElementById("circular-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = `⚠ ${count} circular dependenc${
      count === 1 ? "y" : "ies"
    } detected`;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}
