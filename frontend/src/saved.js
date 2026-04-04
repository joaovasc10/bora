/**
 * saved.js — Saved Events view logic
 * Loads events the user has bookmarked and renders them as cards.
 */

import { apiFetch, isLoggedIn, showToast } from "./auth.js";
import { getCategoryIcon } from "./pins.js";
import { normaliseProps } from "./pins.js";

const API_BASE = "/api";

let _savedEvents = [];
let _sortAsc = false;
let _catFilter = "all";

// ----------------------------------------------------------------
// Initialize
// ----------------------------------------------------------------
export function initSavedView() {
  _bindSortButton();
}

function _bindSortButton() {
  document.getElementById("btn-saved-sort")?.addEventListener("click", () => {
    _sortAsc = !_sortAsc;
    const btn = document.getElementById("btn-saved-sort");
    if (btn) {
      btn.querySelector(".material-symbols-outlined").textContent = _sortAsc
        ? "arrow_upward"
        : "arrow_downward";
    }
    _renderSaved();
  });
}

// ----------------------------------------------------------------
// Load saved events from API
// ----------------------------------------------------------------
export async function loadSavedEvents() {
  if (!isLoggedIn()) {
    _showLoginPrompt();
    return;
  }

  const resp = await apiFetch(`${API_BASE}/events/saved/`);
  if (!resp.ok) {
    showToast("Erro ao carregar eventos salvos", "error");
    return;
  }
  const geojson = await resp.json();
  _savedEvents = (geojson.features || []).map((f) => {
    const props = normaliseProps(f.properties || {});
    if (!props.id && f.id) props.id = f.id;
    return props;
  });

  _buildCategoryChips();
  _renderSaved();
}

function _buildCategoryChips() {
  const container = document.getElementById("saved-cat-chips");
  if (!container) return;

  const cats = new Map();
  for (const ev of _savedEvents) {
    const cat = ev.category;
    if (cat?.slug && !cats.has(cat.slug)) {
      cats.set(cat.slug, cat.name || cat.slug);
    }
  }

  const allBtn = `<button class="chip ${_catFilter === "all" ? "active" : ""}" data-saved-cat="all">Todos</button>`;
  const catBtns = [...cats.entries()]
    .map(
      ([slug, name]) =>
        `<button class="chip ${_catFilter === slug ? "active" : ""}" data-saved-cat="${slug}">${name}</button>`
    )
    .join("");

  container.innerHTML = allBtn + catBtns;

  container.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      _catFilter = btn.dataset.savedCat;
      container.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _renderSaved();
    });
  });
}

function _renderSaved() {
  const grid = document.getElementById("saved-grid");
  const emptyEl = document.getElementById("saved-empty");
  if (!grid) return;

  let events = [..._savedEvents];

  if (_catFilter !== "all") {
    events = events.filter((ev) => ev.category?.slug === _catFilter);
  }

  events.sort((a, b) => {
    const da = new Date(a.start_datetime || 0);
    const db = new Date(b.start_datetime || 0);
    return _sortAsc ? da - db : db - da;
  });

  if (events.length === 0) {
    if (emptyEl) emptyEl.style.display = "flex";
    // Remove any existing cards but keep empty placeholder
    grid.querySelectorAll(".saved-card").forEach((c) => c.remove());
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  const existingCards = grid.querySelectorAll(".saved-card");
  existingCards.forEach((c) => c.remove());

  for (const ev of events) {
    grid.appendChild(_buildSavedCard(ev));
  }
}

function _buildSavedCard(ev) {
  const card = document.createElement("div");
  card.className = "saved-card";
  card.dataset.eventId = ev.id;

  const iconName = getCategoryIcon(ev.category?.slug || ev.category?.name || "");
  const colorHex = ev.category?.color_hex || "#F97316";
  const catLabel = ev.category?.name || "";
  const neighborhood = ev.neighborhood || ev.city?.name || "Porto Alegre";
  const rating = (ev.interaction_counts?.GOING || 0) + (ev.interaction_counts?.INTERESTED || 0);

  const dateStr = ev.start_datetime
    ? new Date(ev.start_datetime).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

  card.innerHTML = `
    <div class="saved-card-cover" style="background:linear-gradient(135deg,${colorHex}22,${colorHex}08)">
      ${ev.cover_image_url ? `<img src="${ev.cover_image_url}" alt="${ev.title || ""}" />` : ""}
      ${rating > 0 ? `<span class="saved-card-rating">★ ${rating}</span>` : ""}
      <div class="saved-card-overlay">
        <span class="saved-card-cat-label" style="color:${colorHex}">${catLabel.toUpperCase()} / ${neighborhood.toUpperCase()}</span>
        <h3 class="saved-card-title">${ev.title || ""}</h3>
        ${dateStr ? `<p class="saved-card-meta"><span class="material-symbols-outlined" style="font-size:13px">calendar_today</span> ${dateStr}</p>` : ""}
      </div>
    </div>
  `;

  card.addEventListener("click", () => {
    // Navigate to map and show event detail
    window.dispatchEvent(new CustomEvent("show:event", { detail: { id: ev.id } }));
  });

  return card;
}

function _showLoginPrompt() {
  const grid = document.getElementById("saved-grid");
  const emptyEl = document.getElementById("saved-empty");
  if (emptyEl) {
    emptyEl.style.display = "flex";
    emptyEl.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:48px;opacity:0.2">lock</span>
      <p>Faça login para ver seus eventos salvos.</p>
    `;
  }
  if (grid) grid.querySelectorAll(".saved-card").forEach((c) => c.remove());
}
