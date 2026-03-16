// ── MAIN MODULE ───────────────────────────────────────────────────────
// Entry point. Wires up all modules: loader, views, ui, theme.

import { initTheme } from "./theme.js";
import { processZip, processFolder } from "./loader.js";
import {
  showToast,
  updateStats,
  renderSidebar,
  updateInfoPanel,
  showGraphUI,
  hideGraphUI,
  showCircularBadge,
} from "./ui.js";
import {
  renderForce,
  renderSunburst,
  renderMatrix,
  renderTreemap,
  renderArc,
  setGraphContext,
  simulation,
  zoomIn,
  zoomOut,
  zoomFit,
  resetLayout,
  selectForceNodeById,
  sbSelectNode,
  sbHighlightFolder,
  mxHover,
  mxUnhover,
  arcHover,
  arcUnhover,
  arcClick,
} from "./views.js";

// ── APP STATE ──────────────────────────────────────────────────────────
let graphData = { nodes: [], edges: [] };
let circularPairs = new Set();
let currentView = "force";

// ── GLOBAL HANDLERS (called from inline SVG events) ───────────────────
window.__depgraph = {
  sbSelectNode: (id) => sbSelectNode(id),
  sbHighlightFolder: (folder) => sbHighlightFolder(folder),
  mxHover: (ri, ci, N) => mxHover(ri, ci, N),
  mxUnhover: () => mxUnhover(),
  arcHover: (s, t) => arcHover(s, t),
  arcUnhover: () => arcUnhover(),
  arcClick: (id) => arcClick(id),
};

// ── INIT ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupDropzone();
  setupKeyboard();

  // Expose global functions for HTML onclick attributes
  window.resetLayout = resetLayout;
  window.resetAll = resetAll;
  window.zoomIn = zoomIn;
  window.zoomOut = zoomOut;
  window.zoomFit = zoomFit;
  window.switchView = switchView;
});

// ── GRAPH LOADED CALLBACK ─────────────────────────────────────────────
function onGraphLoaded(data) {
  graphData = data;
  circularPairs = data.circularPairs;

  setGraphContext(graphData, circularPairs, () => {});

  currentView = "force";
  renderForce();
  renderSidebar(graphData, onSidebarNodeClick);
  updateStats(graphData.nodes, graphData.edges, circularPairs);
  showGraphUI();
  showCircularBadge(circularPairs.size);
}

function onSidebarNodeClick(id) {
  if (currentView === "force") {
    selectForceNodeById(id);
  }
}

// ── VIEW SWITCHING ────────────────────────────────────────────────────
function switchView(name) {
  if (currentView === name) return;
  if (simulation && name !== "force") simulation.stop();
  currentView = name;

  [
    "view-force",
    "view-sunburst",
    "view-matrix-wrap",
    "view-treemap",
    "view-arc",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document
    .querySelectorAll(".vs-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("vs-" + name)?.classList.add("active");

  const showCtrl = name === "force";
  document.getElementById("controls").style.display = showCtrl
    ? "flex"
    : "none";
  document.getElementById("legend").style.display = showCtrl ? "flex" : "none";
  document.getElementById("btn-layout").style.display = showCtrl
    ? "flex"
    : "none";

  if (name === "force") {
    document.getElementById("view-force").style.display = "block";
    if (simulation) simulation.restart();
  } else if (name === "sunburst") {
    document.getElementById("view-sunburst").style.display = "block";
    renderSunburst();
  } else if (name === "matrix") {
    document.getElementById("view-matrix-wrap").style.display = "block";
    renderMatrix();
  } else if (name === "treemap") {
    document.getElementById("view-treemap").style.display = "block";
    renderTreemap();
  } else if (name === "arc") {
    document.getElementById("view-arc").style.display = "block";
    renderArc();
  }
}

// ── RESET ─────────────────────────────────────────────────────────────
function resetAll() {
  graphData = { nodes: [], edges: [] };
  circularPairs = new Set();
  if (simulation) simulation.stop();
  hideGraphUI();
  [
    "view-force",
    "view-sunburst",
    "view-matrix-wrap",
    "view-treemap",
    "view-arc",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  updateInfoPanel(null, graphData, circularPairs);
}

// ── DROPZONE ──────────────────────────────────────────────────────────
function setupDropzone() {
  const dropBox = document.getElementById("drop-box");
  const fileInput = document.getElementById("file-input");
  const folderInput = document.getElementById("folder-input");

  dropBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropBox.classList.add("dragover");
  });
  dropBox.addEventListener("dragleave", () =>
    dropBox.classList.remove("dragover")
  );
  dropBox.addEventListener("drop", (e) => {
    e.preventDefault();
    dropBox.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".zip")) processZip(file, onGraphLoaded);
    else showToast("Please drop a .zip file");
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) processZip(file, onGraphLoaded);
  });

  folderInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    await processFolder(files, onGraphLoaded);
    e.target.value = "";
  });
}

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      d3.selectAll(".node-group")
        .classed("selected", false)
        .classed("highlighted", false)
        .classed("dimmed", false);
      d3.selectAll(".link")
        .classed("highlighted", false)
        .classed("dimmed", false);
      updateInfoPanel(null, graphData, circularPairs);
    }
    if (e.key === "f" || e.key === "F") zoomFit();
    if (e.key === "1") switchView("force");
    if (e.key === "2") switchView("sunburst");
    if (e.key === "3") switchView("matrix");
    if (e.key === "4") switchView("treemap");
    if (e.key === "5") switchView("arc");
  });
}
