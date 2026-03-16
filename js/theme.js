// ── THEME MODULE ──────────────────────────────────────────────────────
// Manages light/dark theme toggling with localStorage persistence

const THEME_KEY = "depgraph-theme";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", toggleTheme);
    updateThemeBtn(saved);
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeBtn(theme);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const sunIcon = btn.querySelector(".icon-sun");
  const moonIcon = btn.querySelector(".icon-moon");
  if (sunIcon) sunIcon.style.display = theme === "dark" ? "block" : "none";
  if (moonIcon) moonIcon.style.display = theme === "light" ? "block" : "none";
  btn.setAttribute(
    "title",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}
