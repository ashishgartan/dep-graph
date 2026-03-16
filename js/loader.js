// ── LOADER MODULE ─────────────────────────────────────────────────────
// Handles ZIP file processing and folder upload processing.
// Emits parsed graph data to the app state.

import {
  analyzeFile,
  resolveImport,
  detectCircular,
  detectEdgeType,
  fileColor,
  resetAliasRoot,
  SUPPORTED,
} from "./parser.js";
import { showToast } from "./ui.js";

const IGNORE =
  /node_modules|\.git|\.next|__pycache__|\.DS_Store|\.min\.|\.map$/;

export async function processZip(file, onComplete) {
  showToast("Reading ZIP...");
  resetAliasRoot();

  const JSZip = window.JSZip;
  const zip = await JSZip.loadAsync(file);
  const allFiles = [];
  const fileContents = {};

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (IGNORE.test(path)) continue;
    const cleanPath = path.replace(/^[^/]+\//, "");
    if (!SUPPORTED.test(cleanPath)) continue;
    try {
      const content = await entry.async("string");
      allFiles.push(cleanPath);
      fileContents[cleanPath] = content;
    } catch (e) {}
  }

  if (allFiles.length === 0) {
    showToast("No supported source files found in ZIP.");
    return;
  }

  const graphData = buildGraph(allFiles, fileContents);
  showToast(
    `✓ ${graphData.nodes.length} files · ${graphData.edges.length} dependencies mapped`
  );
  onComplete(graphData);
}

export async function processFolder(fileList, onComplete) {
  showToast("Reading folder...");
  resetAliasRoot();

  const allFiles = [];
  const fileContents = {};

  for (const file of fileList) {
    const path = file.webkitRelativePath || file.name;
    if (IGNORE.test(path)) continue;
    if (!SUPPORTED.test(path)) continue;
    const cleanPath = path.includes("/")
      ? path.substring(path.indexOf("/") + 1)
      : path;
    try {
      const content = await file.text();
      allFiles.push(cleanPath);
      fileContents[cleanPath] = content;
    } catch (e) {}
  }

  if (allFiles.length === 0) {
    showToast("No supported source files found in folder.");
    return;
  }

  showToast(`Analyzing ${allFiles.length} files...`);
  const graphData = buildGraph(allFiles, fileContents);
  showToast(
    `✓ ${graphData.nodes.length} files · ${graphData.edges.length} dependencies mapped`
  );
  onComplete(graphData);
}

function buildGraph(allFiles, fileContents) {
  const edges = [];
  const edgeSet = new Set();

  for (const file of allFiles) {
    const refs = analyzeFile(fileContents[file] || "", file);
    for (const ref of refs) {
      const resolved = resolveImport(ref, file, allFiles);
      if (resolved && resolved !== file) {
        const key = `${file}→${resolved}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const edgeType = detectEdgeType(ref, fileContents[file] || "");
          edges.push({ source: file, target: resolved, type: edgeType });
        }
      }
    }
  }

  const connected = new Set();
  edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  const nodes = allFiles.map((f) => ({
    id: f,
    color: fileColor(f),
    isolated: !connected.has(f),
  }));

  const circularPairs = detectCircular(edges);

  return { nodes, edges, circularPairs };
}
