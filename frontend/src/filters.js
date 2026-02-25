/**
 * filters.js — Sidebar filter controls (categories, date, free-only, search)
 * Renders category checkboxes dynamically from the API and calls loadAndRenderEvents.
 */

import { loadAndRenderEvents, filters } from "./events.js";

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
// Render category filter checkboxes
// ----------------------------------------------------------------
export function renderCategoryFilters(categories) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500">Nenhuma categoria encontrada.</p>';
    return;
  }

  container.innerHTML = categories
    .map(
      (cat) => `
      <label class="flex items-center gap-2 cursor-pointer py-1 hover:bg-gray-800 rounded-lg px-1 transition group">
        <input type="checkbox" value="${cat.slug}"
          class="category-checkbox w-4 h-4 rounded accent-blue-500 cursor-pointer" />
        <span class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs"
          style="background-color: ${cat.color_hex}20; border: 1.5px solid ${cat.color_hex}">
          ${cat.icon}
        </span>
        <span class="text-sm text-gray-300 group-hover:text-white transition truncate">${cat.name}</span>
      </label>
    `
    )
    .join("");

  // Attach change listeners
  container.querySelectorAll(".category-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      const checked = [...container.querySelectorAll(".category-checkbox:checked")].map(
        (el) => el.value
      );
      filters.categories = checked;
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
