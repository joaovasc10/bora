/**
 * filters.js — Sidebar filter controls (categories, date, free-only, search)
 * Renders category items dynamically from the API and calls loadAndRenderEvents.
 */

import { loadAndRenderEvents, filters } from "./events.js";
import { getCategoryIcon } from "./pins.js";

const API_BASE = "/api";

// ----------------------------------------------------------------
// Fetch categories once and cache
// ----------------------------------------------------------------
let cachedCategories = [];

export async function fetchCategories() {
  if (cachedCategories.length > 0) return cachedCategories;
  try {
    const resp = await fetch(`${API_BASE}/categories/`);
    if (resp.ok) {
      cachedCategories = await resp.json();
    }
  } catch (err) {
    console.error("fetchCategories error:", err);
  }
  return cachedCategories;
}

// ----------------------------------------------------------------
// Render category filter items
// ----------------------------------------------------------------
export function renderCategoryFilters(categories) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--on-surface-variant);padding:8px 0">Nenhuma categoria encontrada.</p>';
    return;
  }

  container.innerHTML = categories
    .map(
      (cat) => `
      <div class="category-item" data-slug="${cat.slug}" title="${cat.name}">
        <span class="material-symbols-outlined">${getCategoryIcon(cat.slug || cat.name || "")}</span>
        <span class="cat-name">${cat.name}</span>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      // Toggle this category
      item.classList.toggle("active", !isActive);

      const active = [...container.querySelectorAll(".category-item.active")].map(
        (el) => el.dataset.slug
      );
      filters.categories = active;
      loadAndRenderEvents();
    });
  });
}

// ----------------------------------------------------------------
// Date filter buttons
// ----------------------------------------------------------------
export function initDateFilters() {
  const btns = document.querySelectorAll(".date-filter-btn");
  const customDate = document.getElementById("custom-date");

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const active = btn.classList.contains("active");

      // Reset all
      btns.forEach((b) => b.classList.remove("active"));
      if (customDate) customDate.value = "";

      if (active) {
        filters.dateFilter = null;
      } else {
        btn.classList.add("active");
        filters.dateFilter = btn.dataset.dateFilter;
      }
      loadAndRenderEvents();
    });
  });

  customDate?.addEventListener("change", () => {
    const val = customDate.value;
    btns.forEach((b) => b.classList.remove("active"));
    filters.dateFilter = val || null;
    loadAndRenderEvents();
  });
}

// ----------------------------------------------------------------
// Free-only toggle
// ----------------------------------------------------------------
export function initFreeFilter() {
  const toggle = document.getElementById("toggle-free");
  toggle?.addEventListener("change", () => {
    filters.isFree = toggle.checked;
    loadAndRenderEvents();
  });
}

// ----------------------------------------------------------------
// Search input (debounced)
// ----------------------------------------------------------------
export function initSearchFilter() {
  const input = document.getElementById("search-input");
  let timeout = null;

  input?.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      filters.searchQ = input.value.trim();
      loadAndRenderEvents();
    }, 400);
  });
}
