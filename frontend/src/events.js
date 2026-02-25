/**
 * events.js — Event API calls, detail sidebar, create modal logic
 */

import { apiFetch, isLoggedIn, showToast } from "./auth.js";
import { flyToEvent, updateMapSource } from "./map.js";
import { renderPins, normaliseProps } from "./pins.js";

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
// Open event detail in right sidebar
// ----------------------------------------------------------------
export function openEventDetail(rawData, coords) {
  const sidebar = document.getElementById("sidebar-right");
  const content = document.getElementById("event-detail-content");
  if (!sidebar || !content) return;

  // Always normalise — data may come from GeoJSON props (strings) or direct API (objects)
  const p = normaliseProps(rawData);

  const counts = p.interaction_counts || {};
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const eventId = p.id;

  if (!eventId) {
    console.error("openEventDetail: missing event id", rawData);
    return;
  }

  // Show sidebar — force via both class removal and inline style
  sidebar.classList.remove("translate-x-full");
  sidebar.style.transform = "translateX(0)";

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  content.innerHTML = `
    <div class="relative">
      ${
        p.cover_image_url
          ? `<img src="${p.cover_image_url}" class="w-full h-48 object-cover" alt="Capa do evento" />`
          : `<div class="w-full h-24 bg-gray-800 flex items-center justify-center text-4xl">${p.category?.icon || "📍"}</div>`
      }
      <button id="btn-close-detail"
        class="absolute top-2 right-2 w-8 h-8 bg-gray-900/80 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition">
        ✕
      </button>
      ${
        p.is_free
          ? `<span class="absolute top-2 left-2 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Gratuito</span>`
          : `<span class="absolute top-2 left-2 bg-yellow-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Pago</span>`
      }
    </div>

    <div class="p-4 space-y-3">
      <div>
        <h2 class="text-lg font-bold leading-tight">${p.title || ""}</h2>
        <p class="text-sm text-gray-400">por <strong>${p.organizer_name || ""}</strong></p>
      </div>

      ${
        p.start_datetime
          ? `<div class="flex items-center gap-2 text-sm text-gray-300">
               🗓️ <span>${formatDate(p.start_datetime)}${p.end_datetime ? ` → ${formatDate(p.end_datetime)}` : ""}</span>
             </div>`
          : ""
      }

      ${
        p.address
          ? `<div class="flex items-start gap-2 text-sm text-gray-300">
               📍 <span>${p.address}${p.neighborhood ? `, ${p.neighborhood}` : ""}</span>
             </div>`
          : ""
      }

      ${p.description ? `<p class="text-sm text-gray-300 leading-relaxed">${p.description}</p>` : ""}

      ${p.price_info && !p.is_free ? `<p class="text-sm text-yellow-400">💰 ${p.price_info}</p>` : ""}

      ${
        tags.length > 0
          ? `<div class="flex flex-wrap gap-1">${tags
              .map((t) => `<span class="event-tag">#${t.name || t}</span>`)
              .join("")}</div>`
          : ""
      }

      <div class="flex gap-2 flex-wrap">
        ${
          p.instagram_url
            ? `<a href="${p.instagram_url}" target="_blank" rel="noopener"
                class="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 transition">
                📸 Instagram</a>`
            : ""
        }
        ${
          p.ticket_url
            ? `<a href="${p.ticket_url}" target="_blank" rel="noopener"
                class="text-xs bg-brand hover:bg-brand-dark px-3 py-1.5 rounded-lg text-white transition">
                🎟️ Ingressos</a>`
            : ""
        }
      </div>

      <div class="flex gap-2 flex-wrap text-sm">
        <button data-action="GOING" data-event-id="${eventId}"
          class="interaction-btn flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-green-900 rounded-lg text-gray-400 hover:text-green-400 transition">
          🙋 Vou (${counts.GOING || 0})
        </button>
        <button data-action="INTERESTED" data-event-id="${eventId}"
          class="interaction-btn flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-yellow-900 rounded-lg text-gray-400 hover:text-yellow-400 transition">
          ⭐ Interessado (${counts.INTERESTED || 0})
        </button>
        <button data-action="SAVED" data-event-id="${eventId}"
          class="interaction-btn flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-blue-900 rounded-lg text-gray-400 hover:text-blue-400 transition">
          🔖 Salvar (${counts.SAVED || 0})
        </button>
      </div>

      <div class="flex gap-2">
        <button data-action="REPORTED" data-event-id="${eventId}"
          class="interaction-btn text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-red-900 rounded-lg text-gray-500 hover:text-red-400 transition">
          🚩 Denunciar
        </button>
        <button class="share-btn text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-300 transition">
          🔗 Compartilhar
        </button>
      </div>
    </div>
  `;

  // Close button
  content.querySelector("#btn-close-detail")?.addEventListener("click", closeEventDetail);

  // Interaction buttons
  content.querySelectorAll(".interaction-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        showToast("Faça login para interagir com o evento.", "info");
        return;
      }
      const action = btn.dataset.action;
      const id = btn.dataset.eventId;
      if (!id || id === "undefined") {
        showToast("Erro: ID do evento inválido.", "error");
        return;
      }
      await handleInteraction(id, action);
    });
  });

  // Share button
  content.querySelector(".share-btn")?.addEventListener("click", () => {
    const url = `${window.location.origin}/events/${eventId}/`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => showToast("Link copiado!", "success"))
      .catch(() => showToast(url, "info"));
  });

  // Fly to event location
  if (coords?.length === 2) flyToEvent(coords);
}

// ----------------------------------------------------------------
// Close right sidebar
// ----------------------------------------------------------------
export function closeEventDetail() {
  const sidebar = document.getElementById("sidebar-right");
  if (!sidebar) return;
  sidebar.classList.add("translate-x-full");
  sidebar.style.transform = "";
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
    populateCategorySelect(categories);
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

function populateCategorySelect(categories) {
  const select = document.querySelector("[name=category]");
  if (!select) return;
  select.innerHTML = '<option value="">Selecione uma categoria...</option>';
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    select.appendChild(opt);
  }
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

  fd.set("lat", lat);
  fd.set("lng", lng);
  fd.set("city", cityId);
  fd.set("is_free", document.getElementById("form-toggle-free")?.checked ? "true" : "false");
  fd.set("tag_names", JSON.stringify([...tagSet]));

  const coverInput = document.getElementById("cover-image-input");
  if (coverInput?.files?.[0]) {
    fd.set("cover_image", coverInput.files[0]);
  }

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
      const errors = Object.values(data).flat().join(" ");
      if (globalErr) {
        globalErr.textContent = errors;
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