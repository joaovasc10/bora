/**
 * events.js — Event API calls, detail sidebar, create modal logic
 */

import { apiFetch, isLoggedIn, showToast } from "./auth.js";
import { flyToEvent, updateMapSource, getMap } from "./map.js";
import { renderPins, normaliseProps, getCategoryIcon } from "./pins.js";

const API_BASE = "/api";

// ----------------------------------------------------------------
// Active filter state
// ----------------------------------------------------------------
export const filters = {
  categories: [],
  dateFilter: null,
  isFree: false,
  searchQ: "",
};

// ----------------------------------------------------------------
// Fetch events from API
// ----------------------------------------------------------------
export async function fetchEvents() {
  const params = new URLSearchParams();

  if (filters.categories.length === 1) {
    params.set("category", filters.categories[0]);
  }
  if (filters.isFree) {
    params.set("is_free", "true");
  }
  if (filters.searchQ) {
    params.set("q", filters.searchQ);
  }

  const today = new Date();
  if (filters.dateFilter === "today") {
    params.set("start_date", today.toISOString().split("T")[0]);
    params.set("end_date", today.toISOString().split("T")[0]);
  } else if (filters.dateFilter === "weekend") {
    const day = today.getDay();
    const fri = new Date(today);
    fri.setDate(today.getDate() + ((5 - day + 7) % 7 || 7));
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    params.set("start_date", fri.toISOString().split("T")[0]);
    params.set("end_date", sun.toISOString().split("T")[0]);
  } else if (filters.dateFilter === "week") {
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
    params.set("start_date", today.toISOString().split("T")[0]);
    params.set("end_date", end.toISOString().split("T")[0]);
  } else if (filters.dateFilter) {
    params.set("start_date", filters.dateFilter);
    params.set("end_date", filters.dateFilter);
  }

  const url = `${API_BASE}/events/${params.toString() ? "?" + params.toString() : ""}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const geojson = await resp.json();
    return geojson;
  } catch (err) {
    console.error("fetchEvents error:", err);
    showToast("Erro ao carregar eventos", "error");
    return { type: "FeatureCollection", features: [] };
  }
}

// ----------------------------------------------------------------
// Load and render events on map
// ----------------------------------------------------------------
export async function loadAndRenderEvents() {
  const geojson = await fetchEvents();
  let features = geojson.features || [];

  // Client-side multi-category filter
  if (filters.categories.length > 1) {
    features = features.filter((f) => {
      const cat = normaliseProps(f.properties || {}).category;
      return filters.categories.includes(cat?.slug);
    });
  }

  const filtered = { ...geojson, features };
  updateMapSource(filtered);
  renderPins(features);
}

// ----------------------------------------------------------------
// Open event detail — floating tooltip card
// ----------------------------------------------------------------
let _activePin = null;

export function openEventDetail(rawData, coords) {
  const p = normaliseProps(rawData);
  if (!p.id && rawData.id) p.id = rawData.id;

  const eventId = p.id;
  if (!eventId) {
    console.error("openEventDetail: missing event id", rawData);
    return;
  }

  if (_activePin) _activePin.classList.remove("active");

  const card = document.getElementById("event-detail-card");
  if (!card) return;

  const now = new Date();
  const start = p.start_datetime ? new Date(p.start_datetime) : null;
  const end = p.end_datetime ? new Date(p.end_datetime) : null;
  const isLive = start && end && now >= start && now <= end;
  const addr = p.address || p.neighborhood || "Porto Alegre";
  const iconName = getCategoryIcon(p.category?.slug || p.category?.name || "");

  card.innerHTML = `
    <div class="event-card-inner">
      <div class="event-card-cover">
        ${p.cover_image_url
      ? `<img src="${p.cover_image_url}" alt="${p.title || ""}" />`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.04));display:flex;align-items:center;justify-content:center">
               <span class="material-symbols-outlined" style="font-size:44px;color:var(--primary);opacity:0.4;font-variation-settings:'FILL' 1">${iconName}</span>
             </div>`
    }
        ${isLive ? `<span class="event-card-live-badge">LIVE</span>` : ""}
        <button id="btn-close-detail"
          style="position:absolute;top:8px;right:8px;width:28px;height:28px;background:rgba(0,0,0,0.65);border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;backdrop-filter:blur(4px)">
          <span class="material-symbols-outlined" style="font-size:14px">close</span>
        </button>
      </div>
      <div class="event-card-body">
        <h3 class="event-card-title">${p.title || ""}</h3>
        <div class="event-card-location">
          <span class="material-symbols-outlined">location_on</span>
          ${addr}
        </div>
        <button class="btn-view-detail" id="btn-view-detail-cta">
          <span class="material-symbols-outlined" style="font-size:15px">open_in_full</span>
          Ver detalhes
        </button>
      </div>
    </div>
    <div class="event-card-arrow"></div>
  `;

  card.classList.add("visible");
  _positionEventCard(card, coords);

  card.querySelector("#btn-close-detail")?.addEventListener("click", closeEventDetail);
  card.querySelector("#btn-view-detail-cta")?.addEventListener("click", () => {
    showFullEventDetail(rawData, coords);
  });

  if (coords?.length === 2) flyToEvent(coords);
}

function _positionEventCard(card, coords) {
  if (!coords || coords.length < 2) return;
  const map = getMap();
  if (!map) return;
  try {
    const point = map.project([coords[0], coords[1]]);
    const mapArea = document.getElementById("map-area");
    const cardW = 268, cardH = 310, margin = 12;
    let left = Math.round(point.x - cardW / 2);
    let top = Math.round(point.y - cardH - 24);
    const areaW = mapArea?.offsetWidth || 800;
    const areaH = mapArea?.offsetHeight || 600;
    left = Math.max(margin, Math.min(left, areaW - cardW - margin));
    top = Math.max(margin, Math.min(top, areaH - cardH - margin));
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.style.transform = "";
  } catch (e) {
    card.style.left = "50%";
    card.style.top = "60px";
    card.style.transform = "translateX(-50%)";
  }
}

export function showFullEventDetail(rawData, coords) {
  const panel = document.getElementById("event-full-panel");
  if (!panel) return;

  const p = normaliseProps(rawData);
  if (!p.id && rawData.id) p.id = rawData.id;
  const eventId = p.id;
  const counts = p.interaction_counts || {};
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const iconName = getCategoryIcon(p.category?.slug || p.category?.name || "");

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  panel.innerHTML = `
    <div style="position:relative">
      <div style="height:200px;background:linear-gradient(135deg,rgba(249,115,22,0.2),rgba(249,115,22,0.04));display:flex;align-items:center;justify-content:center">
        ${p.cover_image_url
      ? `<img src="${p.cover_image_url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" alt="" />`
      : `<span class="material-symbols-outlined" style="font-size:56px;color:var(--primary);opacity:0.3;font-variation-settings:'FILL' 1">${iconName}</span>`
    }
      </div>
      <button id="btn-close-full-detail"
        style="position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(0,0,0,0.65);border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;z-index:2;backdrop-filter:blur(6px)">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
      ${p.is_free
      ? `<span style="position:absolute;top:12px;left:12px;background:#16A34A;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;padding:3px 10px;border-radius:9999px">Gratuito</span>`
      : `<span style="position:absolute;top:12px;left:12px;background:#D97706;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;padding:3px 10px;border-radius:9999px">Pago</span>`
    }
    </div>

    <div style="padding:20px">
      <h2 style="font-size:20px;font-weight:900;letter-spacing:-0.02em;color:var(--on-surface);margin:0 0 4px">${p.title || ""}</h2>
      ${p.organizer_name ? `<p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">por <strong style="color:var(--on-surface)">${p.organizer_name}</strong></p>` : ""}

      ${p.start_datetime ? `
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--on-surface-variant);margin-bottom:10px">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);font-variation-settings:'FILL' 1">calendar_today</span>
          ${formatDate(p.start_datetime)}${p.end_datetime ? ` &rarr; ${formatDate(p.end_datetime)}` : ""}
        </div>` : ""}

      ${(p.address || p.neighborhood) ? `
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--on-surface-variant);margin-bottom:16px">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);font-variation-settings:'FILL' 1">location_on</span>
          ${p.address || ""}${p.neighborhood ? `, ${p.neighborhood}` : ""}
        </div>` : ""}

      ${p.description ? `<p style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;margin-bottom:16px">${p.description}</p>` : ""}
      ${p.price_info && !p.is_free ? `<p style="font-size:13px;color:#F59E0B;margin-bottom:12px">${p.price_info}</p>` : ""}

      ${tags.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
          ${tags.map(t => `<span class="event-tag">#${t.name || t}</span>`).join("")}
        </div>` : ""}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${p.instagram_url ? `
          <a href="${p.instagram_url}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;gap:5px;font-size:12px;background:var(--surface-high);color:var(--on-surface-variant);padding:7px 12px;border-radius:9px;text-decoration:none">
            <span class="material-symbols-outlined" style="font-size:14px">photo_camera</span> Instagram
          </a>` : ""}
        ${p.ticket_url ? `
          <a href="${p.ticket_url}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;gap:5px;font-size:12px;background:var(--primary);color:#fff;padding:7px 12px;border-radius:9px;text-decoration:none">
            <span class="material-symbols-outlined" style="font-size:14px">confirmation_number</span> Ingressos
          </a>` : ""}
      </div>

      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">
        <button data-action="GOING" data-event-id="${eventId}" class="interaction-btn"
          style="display:flex;align-items:center;gap:5px;font-size:12px;padding:8px 13px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
          <span class="material-symbols-outlined" style="font-size:14px">waving_hand</span> Vou (${counts.GOING || 0})
        </button>
        <button data-action="INTERESTED" data-event-id="${eventId}" class="interaction-btn"
          style="display:flex;align-items:center;gap:5px;font-size:12px;padding:8px 13px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
          <span class="material-symbols-outlined" style="font-size:14px">star</span> Interessado (${counts.INTERESTED || 0})
        </button>
        <button data-action="SAVED" data-event-id="${eventId}" class="interaction-btn"
          style="display:flex;align-items:center;gap:5px;font-size:12px;padding:8px 13px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
          <span class="material-symbols-outlined" style="font-size:14px">bookmark</span> Salvar (${counts.SAVED || 0})
        </button>
      </div>

      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button data-action="REPORTED" data-event-id="${eventId}" class="interaction-btn"
          style="display:flex;align-items:center;gap:5px;font-size:11px;padding:7px 11px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
          <span class="material-symbols-outlined" style="font-size:13px">flag</span> Denunciar
        </button>
        <button class="share-btn"
          style="display:flex;align-items:center;gap:5px;font-size:11px;padding:7px 11px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
          <span class="material-symbols-outlined" style="font-size:13px">share</span> Compartilhar
        </button>
        ${isLoggedIn() ? `
          <button id="btn-delete-event" data-event-id="${eventId}"
            style="display:flex;align-items:center;gap:5px;font-size:11px;padding:7px 11px;background:var(--surface-high);border:1px solid var(--outline);border-radius:9px;color:var(--on-surface-variant);cursor:pointer;font-family:inherit">
            <span class="material-symbols-outlined" style="font-size:13px">delete</span> Deletar
          </button>` : ""}
      </div>
    </div>
  `;

  panel.classList.add("open");

  panel.querySelector("#btn-close-full-detail")?.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  panel.querySelectorAll(".interaction-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) { showToast("Faça login para interagir.", "info"); return; }
      const action = btn.dataset.action;
      const id = btn.dataset.eventId;
      if (!id || id === "undefined") { showToast("Erro: ID inválido.", "error"); return; }
      await handleInteraction(id, action);
    });
  });

  panel.querySelector(".share-btn")?.addEventListener("click", () => {
    const url = `${window.location.origin}/events/${eventId}/`;
    navigator.clipboard?.writeText(url)
      .then(() => showToast("Link copiado!", "success"))
      .catch(() => showToast(url, "info"));
  });

  const deleteBtn = panel.querySelector("#btn-delete-event");
  deleteBtn?.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja deletar este evento?")) return;
    try {
      const resp = await apiFetch(`/api/events/${eventId}/`, { method: "DELETE" });
      if (resp.status === 204 || resp.ok) {
        showToast("Evento deletado!", "success");
        closeEventDetail();
        await loadAndRenderEvents();
      } else {
        showToast("Erro ao deletar.", "error");
      }
    } catch (e) {
      showToast("Erro ao deletar.", "error");
    }
  });
}

// ----------------------------------------------------------------
// Close event detail (card + full panel)
// ----------------------------------------------------------------
export function closeEventDetail() {
  const card = document.getElementById("event-detail-card");
  const panel = document.getElementById("event-full-panel");
  card?.classList.remove("visible");
  panel?.classList.remove("open");
  if (_activePin) { _activePin.classList.remove("active"); _activePin = null; }
}

// ----------------------------------------------------------------
// Load events for Explore view bento grid
// ----------------------------------------------------------------
export async function loadExploreEvents() {
  const grid = document.getElementById("explore-grid");
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column:span 3;text-align:center;padding:64px 0;color:var(--on-surface-variant)">
      <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px;opacity:0.3">hourglass_empty</span>
      Carregando eventos...
    </div>`;

  const geojson = await fetchEvents();
  const features = (geojson.features || []).slice(0, 8);

  if (features.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:span 3;text-align:center;padding:64px 0;color:var(--on-surface-variant)">
        <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px;opacity:0.3">event_busy</span>
        Nenhum evento encontrado.
      </div>`;
    return;
  }

  const formatShort = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const hero = features[0];
  const rest = features.slice(1);
  const hp = normaliseProps(hero.properties || {});
  if (!hp.id && hero.id) hp.id = hero.id;

  const heroCard = `
    <div class="card-hero" id="explore-hero-card">
      ${hp.cover_image_url
      ? `<img class="card-hero-img" src="${hp.cover_image_url}" alt="${hp.title || ""}" />`
      : `<div class="card-hero-img" style="background:linear-gradient(135deg,rgba(249,115,22,0.25),rgba(249,115,22,0.05))"></div>`
    }
      <div class="card-hero-overlay"></div>
      <div class="card-hero-badges">
        <span class="badge-featured">Destaque</span>
        ${hp.is_free ? `<span class="badge-free">Entrada Franca</span>` : ""}
      </div>
      <div class="card-hero-content">
        <p class="card-hero-location">${hp.neighborhood || hp.category?.name || "Porto Alegre"}</p>
        <h3 class="card-hero-title">${hp.title || ""}</h3>
        <div class="card-hero-meta">
          ${hp.start_datetime ? `<span><span class="material-symbols-outlined">schedule</span> ${formatShort(hp.start_datetime)}</span>` : ""}
        </div>
      </div>
      <button class="card-hero-cta">
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  `;

  const secondaryCards = rest.map((f) => {
    const ep = normaliseProps(f.properties || {});
    if (!ep.id && f.id) ep.id = f.id;
    const iconName = getCategoryIcon(ep.category?.slug || ep.category?.name || "");
    return `
      <div class="card-secondary" data-event-id="${ep.id}">
        <div class="card-secondary-img-wrap">
          ${ep.cover_image_url
        ? `<img class="card-secondary-img" src="${ep.cover_image_url}" alt="${ep.title || ""}" />`
        : `<div class="card-secondary-img-placeholder">
                 <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);opacity:0.3;font-variation-settings:'FILL' 1">${iconName}</span>
               </div>`
      }
          ${ep.category?.name ? `<span class="card-secondary-cat-badge">${ep.category.name}</span>` : ""}
        </div>
        <div class="card-secondary-body">
          <h4 class="card-secondary-title">${ep.title || ""}</h4>
          ${ep.address || ep.neighborhood ? `
            <div class="card-secondary-distance">
              <span class="material-symbols-outlined">map</span>
              ${ep.address || ep.neighborhood}
            </div>` : ""}
          ${ep.description ? `<p class="card-secondary-desc">${ep.description}</p>` : ""}
          <div class="card-secondary-footer">
            <span class="card-price">${ep.is_free ? "Grátis" : (ep.price_info || "Pago")}</span>
            <span class="card-date">${formatShort(ep.start_datetime)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = heroCard + secondaryCards;

  // Hero card click
  grid.querySelector("#explore-hero-card")?.addEventListener("click", () => {
    showFullEventDetail(hero.properties, hero.geometry?.coordinates);
  });

  // Secondary card clicks
  grid.querySelectorAll(".card-secondary").forEach((card, i) => {
    card.addEventListener("click", () => {
      const f = rest[i];
      if (!f) return;
      showFullEventDetail(f.properties, f.geometry?.coordinates);
    });
  });
}

// ----------------------------------------------------------------
// Handle event interaction
// ----------------------------------------------------------------
async function handleInteraction(eventId, interactionType) {
  const resp = await apiFetch(`${API_BASE}/events/${eventId}/interact/`, {
    method: "POST",
    body: JSON.stringify({ interaction_type: interactionType }),
  });

  if (resp.ok) {
    const data = await resp.json();
    const isRemoval = data.detail?.includes("removed");
    const icons = { GOING: "🙋", INTERESTED: "⭐", SAVED: "🔖", REPORTED: "🚩" };
    showToast(
      isRemoval
        ? `${icons[interactionType]} Removido`
        : `${icons[interactionType]} ${interactionType === "REPORTED" ? "Denúncia enviada" : "Adicionado!"}`,
      isRemoval ? "info" : "success"
    );
  } else {
    showToast("Erro ao registrar interação.", "error");
  }
}

// ----------------------------------------------------------------
// Create event form logic
// ----------------------------------------------------------------
let miniMap = null;
let miniMapMarker = null;
const tagSet = new Set();

export function initCreateEventModal(categories, cityId) {
  const modal = document.getElementById("modal-overlay");
  const form = document.getElementById("form-create-event");
  const btnOpen = document.getElementById("btn-new-event");
  const btnClose = document.getElementById("btn-close-modal");

  if (!modal || !form) return;

  btnOpen?.addEventListener("click", () => {
    if (!isLoggedIn()) {
      showToast("Faça login para publicar um evento.", "info");
      return;
    }
    modal.classList.add("open");
    initMiniMap();
    populateCategoryChips(categories);
  });

  btnClose?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  const freeToggle = document.getElementById("form-toggle-free");
  const priceField = document.getElementById("price-info-field");
  freeToggle?.addEventListener("change", () => {
    priceField?.classList.toggle("hidden", freeToggle.checked);
  });

  const descTA = form.querySelector("[name=description]");
  const descCount = document.getElementById("desc-count");
  descTA?.addEventListener("input", () => {
    if (descCount) descCount.textContent = descTA.value.length;
  });

  const coverInput = document.getElementById("cover-image-input");
  coverInput?.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("cover-preview");
      if (preview) {
        preview.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover rounded-lg" alt="Preview" />`;
      }
    };
    reader.readAsDataURL(file);
  });

  const tagInput = document.getElementById("tag-input");
  const tagBtn = document.getElementById("btn-add-tag");

  function addTag(val) {
    const tag = val.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && tagSet.size < 5) {
      tagSet.add(tag);
      renderTags();
    }
    if (tagInput) tagInput.value = "";
  }

  tagBtn?.addEventListener("click", () => addTag(tagInput?.value || ""));
  tagInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput.value);
    }
  });

  document.getElementById("btn-use-current-location")?.addEventListener("click", () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setModalLocation(pos.coords.longitude, pos.coords.latitude),
      () => showToast("Erro ao obter localização.", "error")
    );
  });

  const locationSearch = document.getElementById("location-search");
  let geocodeTimer;
  locationSearch?.addEventListener("input", () => {
    clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => geocodeAddress(locationSearch.value), 600);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitCreateEvent(form, modal, cityId);
  });
}

function renderTags() {
  const container = document.getElementById("tags-container");
  if (!container) return;
  container.innerHTML = [...tagSet]
    .map(
      (t) =>
        `<span class="event-tag flex items-center gap-1">
          #${t}
          <button type="button" data-tag="${t}" class="remove-tag text-gray-500 hover:text-red-400 leading-none">×</button>
        </span>`
    )
    .join("");

  container.querySelectorAll(".remove-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      tagSet.delete(btn.dataset.tag);
      renderTags();
    });
  });
}

function populateCategoryChips(categories) {
  const chipsContainer = document.getElementById("modal-category-chips");
  const hiddenInput = document.getElementById("modal-category-value");
  if (!chipsContainer) return;

  chipsContainer.innerHTML = categories.map((cat) => {
    const iconName = getCategoryIcon(cat.slug || cat.name || "");
    return `
      <button type="button" class="category-chip" data-cat-id="${cat.id}" data-cat-name="${cat.name || ""}">
        <span class="material-symbols-outlined">${iconName}</span>
        ${cat.name}
      </button>`;
  }).join("");

  chipsContainer.querySelectorAll(".category-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chipsContainer.querySelectorAll(".category-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (hiddenInput) hiddenInput.value = chip.dataset.catId;
    });
  });
}

function initMiniMap() {
  if (miniMap) return;
  const mapboxToken = mapboxgl.accessToken;
  if (!mapboxToken) return;

  miniMap = new mapboxgl.Map({
    container: "mini-map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [-51.2177, -30.0346],
    zoom: 12,
  });

  miniMap.on("click", (e) => {
    setModalLocation(e.lngLat.lng, e.lngLat.lat);
    reverseGeocode(e.lngLat.lng, e.lngLat.lat);
  });
}

function setModalLocation(lng, lat, label) {
  document.getElementById("selected-lng").value = lng;
  document.getElementById("selected-lat").value = lat;

  if (label) {
    const input = document.getElementById("location-search");
    if (input) input.value = label;
  }

  if (miniMap) {
    miniMap.flyTo({ center: [lng, lat], zoom: 15 });
    if (miniMapMarker) {
      miniMapMarker.setLngLat([lng, lat]);
    } else {
      miniMapMarker = new mapboxgl.Marker({ color: "#3B82F6" })
        .setLngLat([lng, lat])
        .addTo(miniMap);
    }
  }

  document.getElementById("location-error")?.classList.add("hidden");
}

async function geocodeAddress(query) {
  if (!query || query.length < 3) return;
  const token = mapboxgl.accessToken;
  if (!token) return;

  try {
    const resp = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=BR&language=pt&proximity=-51.2177,-30.0346`
    );
    const data = await resp.json();
    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center;
      setModalLocation(lng, lat, data.features[0].place_name);
    }
  } catch (err) {
    console.warn("Geocoding error:", err);
  }
}

async function reverseGeocode(lng, lat) {
  const token = mapboxgl.accessToken;
  if (!token) return;

  try {
    const resp = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt&types=address,place`
    );
    const data = await resp.json();
    if (data.features?.length > 0) {
      const name = data.features[0].place_name;
      const searchInput = document.getElementById("location-search");
      const addressInput = document.querySelector("[name=address]");
      if (searchInput) searchInput.value = name;
      if (addressInput) addressInput.value = name;
    }
  } catch (err) {
    console.warn("Reverse geocoding error:", err);
  }
}

async function submitCreateEvent(form, modal, cityId) {
  const btn = document.getElementById("btn-submit-event");
  const spinner = document.getElementById("submit-spinner");
  const label = document.getElementById("submit-label");
  const globalErr = document.getElementById("form-error-global");

  btn.disabled = true;
  spinner?.classList.remove("hidden");
  label.textContent = "Publicando...";
  globalErr?.classList.add("hidden");

  const fd = new FormData(form);
  const lat = document.getElementById("selected-lat").value;
  const lng = document.getElementById("selected-lng").value;

  if (!lat || !lng) {
    const locErr = document.getElementById("location-error");
    if (locErr) {
      locErr.textContent = "Selecione a localização do evento no mapa.";
      locErr.classList.remove("hidden");
    }
    btn.disabled = false;
    spinner?.classList.add("hidden");
    label.textContent = "📍 Publicar evento no mapa";
    return;
  }

  if (!cityId) {
    if (globalErr) {
      globalErr.textContent = "Erro ao carregar dados da cidade. Recarregue a página.";
      globalErr.classList.remove("hidden");
    }
    btn.disabled = false;
    spinner?.classList.add("hidden");
    label.textContent = "📍 Publicar evento no mapa";
    return;
  }

  fd.set("lat", lat);
  fd.set("lng", lng);
  fd.set("city", cityId);
  fd.set("is_free", document.getElementById("form-toggle-free")?.checked ? "true" : "false");
  fd.set("tag_names", JSON.stringify([...tagSet]));

  try {
    const resp = await apiFetch(`/api/events/`, { method: "POST", body: fd });
    const data = await resp.json();

    if (resp.ok) {
      modal.classList.remove("open");
      showToast("🎉 Evento criado com sucesso!", "success");

      // Reload all events so the new pin appears
      await loadAndRenderEvents();

      // Extract coordinates and properties from GeoJSON Feature response
      // Note: GeoFeatureModelSerializer puts PK at feature.id, not properties.id
      const coords = data.geometry?.coordinates;
      const props = { ...(data.properties || data) };
      if (!props.id && data.id) props.id = data.id;

      if (coords) flyToEvent(coords, 16);

      // Wait for renderPins to finish then show detail
      setTimeout(() => openEventDetail(props, coords), 1000);

      // Reset form state
      form.reset();
      tagSet.clear();
      renderTags();
      document.getElementById("selected-lat").value = "";
      document.getElementById("selected-lng").value = "";
      const preview = document.getElementById("cover-preview");
      if (preview) preview.innerHTML = "";
      if (miniMapMarker) {
        miniMapMarker.remove();
        miniMapMarker = null;
      }
    } else {
      // Extract and display validation errors by field
      const errors = data || {};
      const errorMessages = [];

      // Build human-readable error list
      for (const [field, msgs] of Object.entries(errors)) {
        const msgList = Array.isArray(msgs) ? msgs : [msgs];
        msgList.forEach(msg => {
          errorMessages.push(msg);
        });
      }

      if (globalErr) {
        if (errorMessages.length > 0) {
          globalErr.innerHTML = errorMessages
            .map(msg => `<div>• ${msg}</div>`)
            .join('');
        } else {
          globalErr.textContent = "Erro ao criar evento. Verifique os dados e tente novamente.";
        }
        globalErr.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error("Submit event error:", err);
    showToast("Erro ao criar evento. Tente novamente.", "error");
  } finally {
    btn.disabled = false;
    spinner?.classList.add("hidden");
    label.textContent = "📍 Publicar evento no mapa";
  }
}