/**
 * pins.js — Mapbox DOM markers com estilo customizado (substituímos Three.js)
 *
 * Three.js causava problemas de coordenadas e pointer-events.
 * Mapbox GL Markers nativos são mais confiáveis e sincronizam
 * automaticamente com o mapa.
 */

import { getMap } from "./map.js";

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
const activeMarkers = [];   // { marker, eventData }

// ----------------------------------------------------------------
// Helper — safely parse a JSON string (GeoJSON properties are flat)
// ----------------------------------------------------------------
function safeParse(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return val; }
}

// ----------------------------------------------------------------
// Normalise raw GeoJSON properties (all nested objects come as strings)
// ----------------------------------------------------------------
export function normaliseProps(raw) {
  if (!raw || typeof raw !== "object") return {};
  const p = { ...raw };
  p.category = safeParse(p.category) || {};
  p.tags = safeParse(p.tags) || [];
  p.city = safeParse(p.city) || {};
  p.interaction_counts = safeParse(p.interaction_counts) || {};
  return p;
}

// ----------------------------------------------------------------
// Category slug → Material Symbols icon name
// ----------------------------------------------------------------
const SLUG_TO_ICON = {
  musica: "music_note",
  music: "music_note",
  showmusicaaovivo: "music_note",
  show: "music_note",
  arte: "palette",
  art: "palette",
  arteurbana: "brush",
  gastronomia: "restaurant",
  food: "restaurant",
  esporte: "sports_soccer",
  sport: "sports_soccer",
  dance: "nightlife",
  danca: "nightlife",
  teatro: "theater_comedy",
  theater: "theater_comedy",
  cultural: "theater_comedy",
  cinema: "movie",
  movie: "movie",
  educacao: "school",
  educacional: "school",
  education: "school",
  tecnologia: "computer",
  tech: "computer",
  negocios: "business_center",
  business: "business_center",
  networkingempreendedorismo: "groups",
  networking: "groups",
  empreendedorismo: "groups",
  saude: "favorite",
  health: "favorite",
  natureza: "park",
  naturezaoutdoor: "forest",
  outdoor: "forest",
  nature: "park",
  religiao: "church",
  religiosoespiritual: "self_improvement",
  religioso: "self_improvement",
  religion: "church",
  familia: "family_restroom",
  infantilfamilia: "child_care",
  infantil: "child_care",
  family: "family_restroom",
  moda: "checkroom",
  fashion: "checkroom",
  festas: "celebration",
  festabalada: "nightlife",
  balada: "nightlife",
  party: "celebration",
  shows: "stadium",
  feirinhaderumercado: "storefront",
  feirinha: "storefront",
  mercado: "storefront",
  exposicao: "museum",
  exhibition: "museum",
  jogosgeeknerd: "sports_esports",
  jogos: "sports_esports",
  geek: "sports_esports",
  nerd: "sports_esports",
  lgbtqia: "diversity_3",
  petfriendly: "pets",
  pet: "pets",
};

export function getCategoryIcon(slugOrName) {
  if (!slugOrName) return "location_on";
  const key = slugOrName.toLowerCase().replace(/[^a-z]/g, "");
  // Direct match
  if (SLUG_TO_ICON[key]) return SLUG_TO_ICON[key];
  // Partial match
  for (const [k, v] of Object.entries(SLUG_TO_ICON)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return "location_on";
}

// ----------------------------------------------------------------
// Build a DOM pin element (circle with Material Symbols icon)
// ----------------------------------------------------------------
function buildPinElement(colorHex, iconName) {
  const color = colorHex || "#F97316";
  const icon = iconName || "location_on";
  const el = document.createElement("div");
  el.className = "map-pin";
  el.innerHTML = `
    <div class="map-pin-ring" style="border-color:${color}88"></div>
    <div class="map-pin-circle" style="background:${color}">
      <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">${icon}</span>
    </div>
  `;
  return el;
}

// ----------------------------------------------------------------
// Render / update pins from event GeoJSON features
// ----------------------------------------------------------------
export function renderPins(features) {
  // Remove old markers
  for (const { marker } of activeMarkers) marker.remove();
  activeMarkers.length = 0;

  const map = getMap();
  if (!map) return;

  for (const feature of features) {
    if (!feature.geometry?.coordinates) continue;
    const [lng, lat] = feature.geometry.coordinates;
    const rawProps = feature.properties || {};

    // Always normalise
    const props = normaliseProps(rawProps);
    // GeoFeatureModelSerializer puts the PK at feature.id, not feature.properties.id
    if (!props.id && feature.id) {
      props.id = feature.id;
    }
    const colorHex = props.category?.color_hex || "#F97316";
    const iconName = getCategoryIcon(props.category?.slug || props.category?.name || "");

    const el = buildPinElement(colorHex, iconName);

    // Click → dispatch event
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("pin:clicked", {
          detail: { eventData: props, coords: [lng, lat] },
        })
      );
    });

    // Hover effect
    el.addEventListener("mouseenter", () => el.classList.add("map-pin--hover"));
    el.addEventListener("mouseleave", () => el.classList.remove("map-pin--hover"));

    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);

    activeMarkers.push({ marker, eventData: props });
  }
}

// ----------------------------------------------------------------
// No-op exports kept for compatibility (app.js imports these)
// ----------------------------------------------------------------
export function initThreeOverlay() {
  // Three.js overlay replaced by Mapbox DOM markers
  // Nothing to init
}

export function destroyThreeOverlay() {
  for (const { marker } of activeMarkers) marker.remove();
  activeMarkers.length = 0;
}