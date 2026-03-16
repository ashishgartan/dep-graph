// ── VIEWS MODULE ──────────────────────────────────────────────────────
// Renders all 5 visualization views:
//   force, sunburst, matrix, treemap, arc

import { shortName, EDGE_COLORS, EDGE_COLORS_LIGHT } from "./parser.js";
import { updateInfoPanel, highlightSidebar } from "./ui.js";

let _graphData = null;
let _circularPairs = null;
let _onNodeSelect = null;

export let simulation = null;
export let svgZoom = null;

export function setGraphContext(graphData, circularPairs, onNodeSelect) {
  _graphData = graphData;
  _circularPairs = circularPairs;
  _onNodeSelect = onNodeSelect;
}

function isDark() {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

function getEdgeColors() {
  return isDark() ? EDGE_COLORS : EDGE_COLORS_LIGHT;
}

// ── FORCE GRAPH ───────────────────────────────────────────────────────
export function renderForce() {
  const svg = document.getElementById("view-force");
  svg.style.display = "block";
  const g = document.getElementById("zoom-group");
  g.innerHTML = "";

  const W = svg.clientWidth || 900;
  const H = svg.clientHeight || 600;
  const nodes = _graphData.nodes.map((n) => ({ ...n }));
  const edges = _graphData.edges.map((e) => ({ ...e }));
  const edgeColors = getEdgeColors();

  simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(edges)
        .id((d) => d.id)
        .distance(120)
        .strength(0.5)
    )
    .force("charge", d3.forceManyBody().strength(-280))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collision", d3.forceCollide(60));

  svgZoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (e) => {
      d3.select(g).attr("transform", e.transform);
    });
  d3.select(svg).call(svgZoom);

  const svgSel = d3.select(g);

  const link = svgSel
    .append("g")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("class", "link")
    .style("stroke", (d) => edgeColors[d.type] || edgeColors.import)
    .attr("stroke-dasharray", (d) =>
      d.type === "style" ? "4,3" : d.type === "data" ? "2,3" : null
    );

  const nodeGroup = svgSel
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node-group")
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => {
      event.stopPropagation();
      selectForceNode(d, link, nodeGroup);
    });

  nodeGroup.style("opacity", (d) => (d.isolated ? 0.4 : 1));

  nodeGroup
    .append("rect")
    .attr("class", "node-rect")
    .attr("rx", 8)
    .attr("width", (d) => Math.max(shortName(d.id).length * 7 + 24, 80))
    .attr("height", 34)
    .attr("x", (d) => -Math.max(shortName(d.id).length * 7 + 24, 80) / 2)
    .attr("y", -17)
    .attr("stroke", (d) =>
      _circularPairs.has(d.id) ? "rgba(248,113,113,0.6)" : undefined
    );

  nodeGroup
    .append("rect")
    .attr("rx", 3)
    .attr("width", 3)
    .attr("height", 18)
    .attr("x", (d) => -Math.max(shortName(d.id).length * 7 + 24, 80) / 2 + 8)
    .attr("y", -9)
    .attr("fill", (d) => d.color);

  nodeGroup
    .append("text")
    .attr("class", "node-label")
    .attr("dy", "0.35em")
    .attr("x", (d) => -Math.max(shortName(d.id).length * 7 + 24, 80) / 2 + 18)
    .text((d) => shortName(d.id));

  d3.select(svg).on("click", () => {
    nodeGroup
      .classed("selected", false)
      .classed("highlighted", false)
      .classed("dimmed", false);
    link.classed("highlighted", false).classed("dimmed", false);
    updateInfoPanel(null, _graphData, _circularPairs);
  });

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

function selectForceNode(d, link, nodeGroup) {
  const connected = new Set([d.id]);
  _graphData.edges.forEach((e) => {
    if ((e.source.id || e.source) === d.id)
      connected.add(e.target.id || e.target);
    if ((e.target.id || e.target) === d.id)
      connected.add(e.source.id || e.source);
  });

  nodeGroup
    .classed("selected", (n) => n.id === d.id)
    .classed("highlighted", (n) => n.id !== d.id && connected.has(n.id))
    .classed("dimmed", (n) => !connected.has(n.id));

  link
    .classed(
      "highlighted",
      (e) =>
        (e.source.id || e.source) === d.id || (e.target.id || e.target) === d.id
    )
    .classed(
      "dimmed",
      (e) =>
        (e.source.id || e.source) !== d.id && (e.target.id || e.target) !== d.id
    );

  updateInfoPanel(d, _graphData, _circularPairs);
  highlightSidebar(d.id);
  if (_onNodeSelect) _onNodeSelect(d.id);
}

export function selectForceNodeById(id) {
  const node = _graphData.nodes.find((n) => n.id === id);
  if (!node) return;
  const nodeGroups = d3.select("#zoom-group").selectAll(".node-group");
  const links = d3.select("#zoom-group").selectAll(".link");
  selectForceNode(node, links, nodeGroups);
}

// ── ZOOM CONTROLS ──────────────────────────────────────────────────────
export function zoomIn() {
  d3.select("#view-force").transition().call(svgZoom.scaleBy, 1.4);
}
export function zoomOut() {
  d3.select("#view-force").transition().call(svgZoom.scaleBy, 0.7);
}
export function zoomFit() {
  const svg = document.getElementById("view-force");
  const g = document.getElementById("zoom-group");
  const bounds = g.getBBox();
  const W = svg.clientWidth,
    H = svg.clientHeight;
  const scale = Math.min(W / bounds.width, H / bounds.height) * 0.85;
  const tx = W / 2 - scale * (bounds.x + bounds.width / 2);
  const ty = H / 2 - scale * (bounds.y + bounds.height / 2);
  d3.select(svg)
    .transition()
    .duration(500)
    .call(svgZoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}
export function resetLayout() {
  if (simulation) simulation.alpha(1).restart();
}

// ── SUNBURST ──────────────────────────────────────────────────────────
export function renderSunburst() {
  const svg = document.getElementById("view-sunburst");
  const W = svg.clientWidth || 700,
    H = svg.clientHeight || 600;
  const cx = W / 2,
    cy = H / 2,
    r0 = 40,
    r1 = 90,
    r2 = 160;
  const N = _graphData.nodes.length || 1;

  const folderMap = {};
  _graphData.nodes.forEach((n) => {
    const folder = n.id.split("/")[0] || "root";
    if (!folderMap[folder]) folderMap[folder] = [];
    folderMap[folder].push(n);
  });
  const folders = Object.keys(folderMap);

  let html = `<defs></defs>`;
  html += `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="var(--bg2)" stroke="var(--border)" stroke-width="1"/>`;
  html += `<text x="${cx}" y="${
    cy - 7
  }" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text)">${N}</text>`;
  html += `<text x="${cx}" y="${
    cy + 9
  }" text-anchor="middle" font-size="10" fill="var(--text2)">files</text>`;

  let angle = -Math.PI / 2;

  folders.forEach((folder) => {
    const fNodes = folderMap[folder] || [];
    const sweep = (fNodes.length / N) * Math.PI * 2;
    const mid = angle + sweep / 2;
    const lg = sweep > Math.PI ? 1 : 0;

    const ax1 = cx + Math.cos(angle) * r1,
      ay1 = cy + Math.sin(angle) * r1;
    const ax2 = cx + Math.cos(angle + sweep) * r1,
      ay2 = cy + Math.sin(angle + sweep) * r1;
    const ax3 = cx + Math.cos(angle + sweep) * r2,
      ay3 = cy + Math.sin(angle + sweep) * r2;
    const ax4 = cx + Math.cos(angle) * r2,
      ay4 = cy + Math.sin(angle) * r2;
    const col = folderColor(folder);

    html += `<path d="M${ax1},${ay1} A${r1},${r1} 0 ${lg} 1 ${ax2},${ay2} L${ax3},${ay3} A${r2},${r2} 0 ${lg} 0 ${ax4},${ay4} Z"
      fill="${col}" opacity="0.75" stroke="var(--bg)" stroke-width="1.5" style="cursor:pointer"
      onclick="window.__depgraph.sbHighlightFolder('${folder}')"/>`;

    if (sweep > 0.35) {
      const lx = cx + Math.cos(mid) * (r1 + (r2 - r1) * 0.5);
      const ly = cy + Math.sin(mid) * (r1 + (r2 - r1) * 0.5);
      html += `<text x="${lx}" y="${
        ly + 4
      }" text-anchor="middle" font-size="9" font-weight="600" fill="#fff" pointer-events="none">${folder.slice(
        0,
        8
      )}</text>`;
    }

    let fAngle = angle;
    fNodes.forEach((node) => {
      const fSweep = (1 / N) * Math.PI * 2;
      const depCount = _graphData.edges.filter(
        (e) =>
          (e.source.id || e.source) === node.id ||
          (e.target.id || e.target) === node.id
      ).length;
      const outerR = r2 + 20 + Math.min(depCount * 12, 60);
      const fx1 = cx + Math.cos(fAngle) * r2,
        fy1 = cy + Math.sin(fAngle) * r2;
      const fx2 = cx + Math.cos(fAngle + fSweep) * r2,
        fy2 = cy + Math.sin(fAngle + fSweep) * r2;
      const fx3 = cx + Math.cos(fAngle + fSweep) * outerR,
        fy3 = cy + Math.sin(fAngle + fSweep) * outerR;
      const fx4 = cx + Math.cos(fAngle) * outerR,
        fy4 = cy + Math.sin(fAngle) * outerR;
      html += `<path data-id="${
        node.id
      }" d="M${fx1},${fy1} A${r2},${r2} 0 0 1 ${fx2},${fy2} L${fx3},${fy3} A${outerR},${outerR} 0 0 0 ${fx4},${fy4} Z"
        fill="${col}" opacity="${
        0.35 + Math.min(depCount / 10, 0.55)
      }" stroke="var(--bg)" stroke-width="1" style="cursor:pointer"
        onclick="window.__depgraph.sbSelectNode('${
          node.id
        }')" title="${shortName(node.id)} · ${depCount} connections"/>`;
      if (fSweep > 0.12 && outerR - r2 > 16) {
        const fMid = fAngle + fSweep / 2;
        const fLR = r2 + (outerR - r2) * 0.5;
        html += `<text x="${cx + Math.cos(fMid) * fLR}" y="${
          cy + Math.sin(fMid) * fLR + 3
        }" text-anchor="middle" font-size="8" fill="#fff" opacity="0.9" pointer-events="none">${shortName(
          node.id
        ).slice(0, 6)}</text>`;
      }
      fAngle += fSweep;
    });
    angle += sweep;
  });

  svg.innerHTML = html;
}

export function sbSelectNode(id) {
  const node = _graphData.nodes.find((n) => n.id === id);
  updateInfoPanel(node || { id }, _graphData, _circularPairs);
  highlightSidebar(id);
  document.querySelectorAll("#view-sunburst path[data-id]").forEach((p) => {
    p.style.opacity = p.dataset.id === id ? "1" : "0.2";
  });
}

export function sbHighlightFolder(folder) {
  document.querySelectorAll("#view-sunburst path[data-id]").forEach((p) => {
    const pFolder = p.dataset.id ? p.dataset.id.split("/")[0] : "";
    p.style.opacity = pFolder === folder ? "1" : "0.2";
  });
}

function folderColor(folder) {
  const map = {
    app: "#7c6aff",
    components: "#22d3ee",
    hooks: "#34d399",
    lib: "#f59e0b",
    types: "#f472b6",
    ui: "#3b82f6",
    config: "#a78bfa",
    utils: "#fb923c",
    pages: "#e879f9",
    api: "#38bdf8",
    store: "#4ade80",
    styles: "#f472b6",
  };
  const keys = Object.keys(map);
  const idx =
    [...folder].reduce((s, c) => s + c.charCodeAt(0), 0) % keys.length;
  return map[folder] || map[keys[idx]] || "#8888a0";
}

// ── MATRIX ────────────────────────────────────────────────────────────
export function renderMatrix() {
  const nodes = _graphData.nodes;
  const N = nodes.length;
  if (!N) return;

  const adj = Array.from({ length: N }, () => new Set());
  _graphData.edges.forEach((e) => {
    const si = nodes.findIndex((n) => n.id === (e.source.id || e.source));
    const ti = nodes.findIndex((n) => n.id === (e.target.id || e.target));
    if (si >= 0 && ti >= 0) adj[si].add(ti);
  });

  function trans(i, visited = new Set()) {
    if (visited.has(i)) return visited;
    visited.add(i);
    adj[i].forEach((j) => trans(j, visited));
    return visited;
  }
  const transClosure = nodes.map((_, i) => trans(i));

  let html = "<thead><tr><th></th>";
  nodes.forEach(
    (n) =>
      (html += `<th class="mx-col-label" title="${n.id}">${shortName(
        n.id
      )}</th>`)
  );
  html += "</tr></thead><tbody>";

  nodes.forEach((rn, ri) => {
    html += `<tr><td class="mx-row-label" title="${rn.id}">${shortName(
      rn.id
    )}</td>`;
    nodes.forEach((cn, ci) => {
      const direct = adj[ri].has(ci);
      const tran = !direct && transClosure[ri].has(ci) && ri !== ci;
      const diag = ri === ci;
      const cls = diag
        ? "mx-cell diagonal"
        : direct
        ? "mx-cell direct"
        : tran
        ? "mx-cell transitive"
        : "mx-cell";
      html += `<td class="${cls}"
        onmouseenter="window.__depgraph.mxHover(${ri},${ci},${N})"
        onmouseleave="window.__depgraph.mxUnhover()"
        title="${
          direct ? "Direct import" : tran ? "Transitive" : "No relation"
        }"></td>`;
    });
    html += "</tr>";
  });
  html += "</tbody>";
  document.getElementById("mx-table").innerHTML = html;
}

export function mxHover(ri, ci, N) {
  document.querySelectorAll("#mx-table .mx-cell").forEach((el, idx) => {
    const row = Math.floor(idx / N),
      col = idx % N;
    if (row === ri || col === ci) el.classList.add("row-hi");
  });
}
export function mxUnhover() {
  document
    .querySelectorAll("#mx-table .mx-cell")
    .forEach((el) => el.classList.remove("row-hi"));
}

// ── TREEMAP ───────────────────────────────────────────────────────────
export function renderTreemap() {
  const container = document.getElementById("view-treemap");
  const W = container.clientWidth || 700,
    H = container.clientHeight || 600;
  container.querySelectorAll(".tm-block").forEach((el) => el.remove());

  const scored = _graphData.nodes
    .map((n) => {
      const imports = _graphData.edges.filter(
        (e) => (e.source.id || e.source) === n.id
      ).length;
      const importedBy = _graphData.edges.filter(
        (e) => (e.target.id || e.target) === n.id
      ).length;
      return { ...n, imports, importedBy, total: imports + importedBy };
    })
    .sort((a, b) => b.total - a.total);

  if (!scored.length) return;
  const total = scored.reduce((s, n) => s + Math.max(n.total, 0.5), 0);
  const items = scored.map((n) => ({
    ...n,
    area: (Math.max(n.total, 0.5) / total) * W * H,
  }));
  const rects = squarify(items, 0, 0, W, H);
  const tip = document.getElementById("tm-tip");

  rects.forEach(({ item, x, y, w, h }) => {
    if (w < 10 || h < 10) return;
    const div = document.createElement("div");
    div.className = "tm-block";
    div.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${(
      w - 2
    ).toFixed(1)}px;height:${(h - 2).toFixed(1)}px;background:${
      item.color
    }22;border-color:${item.color}55;`;
    if (w > 36 && h > 28) {
      const fs = Math.min(11, Math.max(8, w / 10));
      div.innerHTML = `<div class="tm-name" style="color:${
        item.color
      };font-size:${fs}px">${shortName(item.id)}</div>${
        h > 40
          ? `<div class="tm-info" style="color:${item.color}">${item.total} links</div>`
          : ""
      }`;
    }
    div.addEventListener("mouseenter", () => {
      tip.textContent = `${item.id} · ${item.imports} imports · ${item.importedBy} imported by`;
      tip.style.display = "block";
      updateInfoPanel(item, _graphData, _circularPairs);
      highlightSidebar(item.id);
    });
    div.addEventListener("mouseleave", () => (tip.style.display = "none"));
    div.addEventListener("click", () => {
      updateInfoPanel(item, _graphData, _circularPairs);
      highlightSidebar(item.id);
    });
    container.appendChild(div);
  });
}

function squarify(items, x, y, w, h) {
  if (!items.length) return [];
  const rects = [];
  let remaining = [...items];
  let rx = x,
    ry = y,
    rw = w,
    rh = h;

  while (remaining.length) {
    const isHoriz = rw >= rh;
    const row = [];
    let i = 0;
    for (; i < remaining.length; i++) {
      const test = [...row, remaining[i]];
      const testArea = test.reduce((s, it) => s + it.area, 0);
      const side = isHoriz ? rh : rw;
      const worst = (items2, side2) => {
        const s = items2.reduce((a, it) => a + it.area, 0);
        return Math.max(
          ...items2.map((it) =>
            Math.max(
              (side2 * side2 * it.area) / (s * s),
              (s * s) / (side2 * side2 * it.area)
            )
          )
        );
      };
      if (row.length && worst(test, side) > worst(row, side)) break;
      row.push(remaining[i]);
    }
    remaining = remaining.slice(row.length);
    const side = isHoriz ? rh : rw;
    const rowArea = row.reduce((s, it) => s + it.area, 0);
    const rowLen = rowArea / side;
    let pos = isHoriz ? ry : rx;
    row.forEach((item) => {
      const len = item.area / rowLen;
      if (isHoriz) {
        rects.push({ item, x: rx, y: pos, w: rowLen, h: len });
        pos += len;
      } else {
        rects.push({ item, x: pos, y: ry, w: len, h: rowLen });
        pos += len;
      }
    });
    if (isHoriz) {
      rx += rowLen;
      rw -= rowLen;
    } else {
      ry += rowLen;
      rh -= rowLen;
    }
  }
  return rects;
}

// ── ARC DIAGRAM ───────────────────────────────────────────────────────
export function renderArc() {
  const container = document.getElementById("view-arc");
  const cW = container.clientWidth || 700;
  const nodes = _graphData.nodes;
  const N = nodes.length;
  if (!N) return;

  const pad = { l: 60, r: 60, t: 30, b: 100 };
  const innerW = Math.max(cW - pad.l - pad.r, N * 28);
  const W = innerW + pad.l + pad.r;
  const maxArcH = 220;
  const H = maxArcH + pad.t + pad.b + 20;
  const baseY = maxArcH + pad.t;
  const step = innerW / Math.max(N - 1, 1);

  const svg = document.getElementById("arc-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const nx = (i) => pad.l + i * step;
  let html = "";

  _graphData.edges.forEach((e) => {
    const si = nodes.findIndex((n) => n.id === (e.source.id || e.source));
    const ti = nodes.findIndex((n) => n.id === (e.target.id || e.target));
    if (si < 0 || ti < 0 || si === ti) return;
    const x1 = nx(si),
      x2 = nx(ti);
    const mid = (x1 + x2) / 2;
    const dist = Math.abs(ti - si);
    const arcH = Math.min(dist * step * 0.6, maxArcH);
    html += `<path class="arc-link" data-s="${si}" data-t="${ti}"
      d="M${x1},${baseY} Q${mid},${baseY - arcH} ${x2},${baseY}"
      stroke="${nodes[si].color}" stroke-width="1.5"
      onmouseenter="window.__depgraph.arcHover(${si},${ti})"
      onmouseleave="window.__depgraph.arcUnhover()"/>`;
  });

  nodes.forEach((n, i) => {
    const x = nx(i);
    const connCount = _graphData.edges.filter(
      (e) =>
        (e.source.id || e.source) === n.id || (e.target.id || e.target) === n.id
    ).length;
    const r = Math.max(4, Math.min(10, 3 + connCount));
    html += `<circle class="arc-node-circle" data-idx="${i}" cx="${x}" cy="${baseY}" r="${r}"
      fill="${n.color}" stroke="var(--bg)" stroke-width="1.5"
      onmouseenter="window.__depgraph.arcHover(${i},-1)"
      onmouseleave="window.__depgraph.arcUnhover()"
      onclick="window.__depgraph.arcClick('${n.id}')"/>`;
  });

  nodes.forEach((n, i) => {
    const x = nx(i),
      y = baseY + 14;
    html += `<text x="${x}" y="${y}" text-anchor="end"
      transform="rotate(-45,${x},${y})" font-size="10" font-weight="500"
      fill="${n.color}" pointer-events="none">${shortName(n.id)}</text>`;
  });

  svg.innerHTML = html;
}

export function arcHover(s, t) {
  document.querySelectorAll(".arc-link").forEach((p) => {
    const ps = parseInt(p.dataset.s),
      pt = parseInt(p.dataset.t);
    const rel =
      t === -1
        ? ps === s || pt === s
        : (ps === s && pt === t) || (ps === t && pt === s);
    p.style.opacity = rel ? "1" : "0.06";
    p.style.strokeWidth = rel ? "2.5" : "1";
  });
  document.querySelectorAll(".arc-node-circle").forEach((c) => {
    const ci = parseInt(c.dataset.idx);
    c.style.opacity = ci === s || (t >= 0 && ci === t) ? "1" : "0.2";
  });
}

export function arcUnhover() {
  document.querySelectorAll(".arc-link").forEach((p) => {
    p.style.opacity = "";
    p.style.strokeWidth = "";
  });
  document
    .querySelectorAll(".arc-node-circle")
    .forEach((c) => (c.style.opacity = ""));
}

export function arcClick(id) {
  const node = _graphData.nodes.find((n) => n.id === id);
  if (node) {
    updateInfoPanel(node, _graphData, _circularPairs);
    highlightSidebar(id);
  }
}
