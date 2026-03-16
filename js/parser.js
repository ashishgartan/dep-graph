// ── PARSER MODULE ─────────────────────────────────────────────────────
// Handles file content analysis, import extraction, alias resolution,
// circular dependency detection, and edge type classification.

export const SUPPORTED = /\.[a-zA-Z0-9]+$|\bDockerfile\b|\b\.env\b/i;

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\w$\s{},*]+\s+from\s+)?['"`]([^'"`\n]+)['"`]/g,
  /\brequire\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g,
  /\bexport\s+(?:type\s+)?(?:[\w$\s{},*]+\s+from\s+)?['"`]([^'"`\n]+)['"`]/g,
  /\bimport\s*\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g,
  /@(?:import|use|forward)\s+(?:url\s*\(\s*)?['"]?([^'"\s);]+)['"]?\s*\)?/g,
  /\b(?:src|href|action|data-src)\s*=\s*['"]([^'"#?\s][^'"]*)['"]/g,
  /^from\s+([\w./]+)\s+import/gm,
  /^import\s+([\w./]+)/gm,
  /\brequire(?:_relative)?\s+['"]([^'"]+)['"]/g,
  /\bimport\s+(?:[\w]+\s+)?['"]([^'"]+)['"]/g,
  /^use\s+([\w:./]+)/gm,
  /^mod\s+([\w]+)/gm,
  /^import\s+(?:static\s+)?([\w./\\]+)/gm,
  /^using\s+([\w.]+)/gm,
  /#include\s+["<]([^>"]+)[">]/g,
  /\b(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/g,
  /^use\s+([\w\\]+)/gm,
  /#import\s+['"]([^'"]+)['"]/g,
  /^import\s+['"]([^'"]+)['"]/gm,
  /^(?:import|alias|use)\s+([\w./]+)/gm,
  /\brequire\s*\(?['"]([^'"]+)['"]\)?/g,
  /(?:^|\s)(?:source|\.)\s+([./][\w./\-]+)/gm,
  /"\$(?:ref|schema)"\s*:\s*"([^"]+)"/g,
  /^(?:COPY|ADD)\s+(\S+)\s+/gm,
  /^FROM\s+(\S+)/gm,
  /^include\s+(\S+)/gm,
  /(?:xlink:href|href)\s*=\s*['"]([^'"#]+)['"]/g,
];

export function analyzeFile(content, filePath) {
  const refs = new Set();
  for (const pat of IMPORT_PATTERNS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(content)) !== null) {
      const val = (m[1] || "").trim();
      if (
        val &&
        !val.startsWith("http") &&
        !val.startsWith("//") &&
        !val.startsWith("data:") &&
        val.length > 0 &&
        val.length < 300
      ) {
        refs.add(val);
      }
    }
  }
  return [...refs];
}

// ── ALIAS ROOT AUTO-DETECTION ─────────────────────────────────────────
function detectAliasRoot(allFiles) {
  const roots = ["src", "app", ""];
  for (const root of roots) {
    const prefix = root ? root + "/" : "";
    const hit = allFiles.some(
      (f) =>
        f.startsWith(prefix + "components/") ||
        f.startsWith(prefix + "hooks/") ||
        f.startsWith(prefix + "lib/") ||
        f.startsWith(prefix + "pages/") ||
        f.startsWith(prefix + "utils/")
    );
    if (hit) return prefix;
  }
  return "";
}

let _aliasRoot = null;

export function getAliasRoot(allFiles) {
  if (_aliasRoot === null) _aliasRoot = detectAliasRoot(allFiles);
  return _aliasRoot;
}

export function resetAliasRoot() {
  _aliasRoot = null;
}

export function resolveImport(importPath, fromFile, allFiles) {
  const aliasRoot = getAliasRoot(allFiles);

  if (importPath.startsWith("@/")) importPath = aliasRoot + importPath.slice(2);
  else if (importPath.startsWith("~/"))
    importPath = aliasRoot + importPath.slice(2);

  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    const direct = allFiles.find(
      (f) =>
        f === importPath ||
        f.startsWith(importPath + ".") ||
        f.startsWith(importPath + "/")
    );
    return direct || null;
  }

  const fromDir = fromFile.includes("/")
    ? fromFile.substring(0, fromFile.lastIndexOf("/"))
    : "";

  const extensions = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".swift",
    ".c",
    ".cpp",
    ".cs",
    ".php",
    ".dart",
    ".vue",
    ".svelte",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".graphql",
    ".gql",
    ".sql",
    ".sh",
    ".lua",
    "/index.ts",
    "/index.tsx",
    "/index.js",
    "/index.jsx",
    "/index.mjs",
    "/mod.ts",
    "/mod.js",
    "/main.go",
    "/lib.rs",
    "/__init__.py",
  ];

  let base = importPath;
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    base = resolvePath(fromDir, importPath);
  } else if (importPath.startsWith("/")) {
    base = importPath.slice(1);
  }

  if (/\.[a-zA-Z0-9]+$/.test(base)) {
    const clean = base.replace(/^\//, "");
    const found = allFiles.find((f) => f === clean || f.endsWith("/" + clean));
    if (found) return found;
  }

  for (const ext of extensions) {
    const candidate = (base + ext).replace(/^\//, "");
    const found = allFiles.find(
      (f) => f === candidate || f.endsWith("/" + candidate)
    );
    if (found) return found;
  }
  return null;
}

function resolvePath(base, rel) {
  const parts = base ? base.split("/") : [];
  const relParts = rel.split("/");
  for (const p of relParts) {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  }
  return parts.join("/");
}

export function detectCircular(edges) {
  const adj = {};
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });

  const circular = new Set();
  const visited = new Set();
  const stack = new Set();

  function dfs(node, path) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      if (idx !== -1) {
        const cycle = path.slice(idx);
        cycle.forEach((n) => circular.add(n));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    (adj[node] || []).forEach((next) => dfs(next, [...path]));
    stack.delete(node);
  }

  Object.keys(adj).forEach((n) => dfs(n, []));
  return circular;
}

export function detectEdgeType(ref, content) {
  if (
    /@import|@use|@forward/.test(ref) ||
    ref.endsWith(".css") ||
    ref.endsWith(".scss")
  )
    return "style";
  if (
    ref.endsWith(".json") ||
    ref.endsWith(".yaml") ||
    ref.endsWith(".yml") ||
    ref.endsWith(".toml")
  )
    return "data";
  if (ref.endsWith(".html") || ref.endsWith(".htm") || ref.endsWith(".svg"))
    return "asset";
  if (ref.endsWith(".graphql") || ref.endsWith(".gql")) return "query";
  if (/require\s*\(/.test(content)) return "require";
  return "import";
}

export const EDGE_COLORS = {
  import: "#3a3a5c",
  require: "#2a4a3a",
  style: "#4a2a4a",
  data: "#3a4a2a",
  asset: "#4a3a2a",
  query: "#2a3a4a",
};

export const EDGE_COLORS_LIGHT = {
  import: "#c7c7e0",
  require: "#b0d4be",
  style: "#dab0da",
  data: "#c4d4a0",
  asset: "#d4c0a0",
  query: "#a0b8d4",
};

export function fileColor(name) {
  const filename = name.split("/").pop().toLowerCase();
  const ext = filename.includes(".") ? filename.split(".").pop() : filename;
  const map = {
    tsx: "#22d3ee",
    jsx: "#22d3ee",
    ts: "#3b82f6",
    js: "#f59e0b",
    mjs: "#f59e0b",
    cjs: "#f59e0b",
    vue: "#4ade80",
    svelte: "#fb923c",
    css: "#f472b6",
    scss: "#f472b6",
    sass: "#f472b6",
    less: "#f472b6",
    py: "#34d399",
    rb: "#e53e3e",
    go: "#22d3ee",
    rs: "#fb923c",
    java: "#fbbf24",
    kt: "#a78bfa",
    kts: "#a78bfa",
    c: "#60a5fa",
    cpp: "#60a5fa",
    cc: "#60a5fa",
    h: "#93c5fd",
    hpp: "#93c5fd",
    cs: "#818cf8",
    php: "#a78bfa",
    swift: "#fb923c",
    dart: "#38bdf8",
    html: "#f97316",
    htm: "#f97316",
    json: "#facc15",
    yaml: "#facc15",
    yml: "#facc15",
    toml: "#facc15",
    xml: "#facc15",
    md: "#94a3b8",
    mdx: "#94a3b8",
    graphql: "#e879f9",
    gql: "#e879f9",
    sql: "#38bdf8",
    sh: "#4ade80",
    bash: "#4ade80",
    zsh: "#4ade80",
    proto: "#818cf8",
    lua: "#60a5fa",
    r: "#60a5fa",
    ex: "#a78bfa",
    exs: "#a78bfa",
    zig: "#fb923c",
    nim: "#f59e0b",
  };
  if (filename === "dockerfile" || filename.startsWith("dockerfile."))
    return "#38bdf8";
  if (filename.endsWith(".env") || filename.startsWith(".env"))
    return "#facc15";
  return map[ext] || "#8888a0";
}

export function shortName(path) {
  return path.split("/").pop();
}
