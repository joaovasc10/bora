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
  p.category           = safeParse(p.category)           || {};
  p.tags               = safeParse(p.tags)               || [];
  p.city               = safeParse(p.city)               || {};
  p.interaction_counts = safeParse(p.interaction_counts) || {};
  return p;
}

// ----------------------------------------------------------------
// Build a DOM pin element
// ----------------------------------------------------------------
function buildPinElement(colorHex, icon) {
  const color = colorHex || "#3B82F6";
  const el = document.createElement("div");
  el.className = "map-pin";
  el.innerHTML = `
    <div class="map-pin-head" style="background:${color}; box-shadow: 0 2px 8px ${color}88;">
      <span class="map-pin-icon">${icon || "📍"}</span>
    </div>
    <div class="map-pin-needle" style="border-top-color:${color};"></div>
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
    const colorHex = props.category?.color_hex || "#3B82F6";
    const icon     = props.category?.icon || "📍";

    const el = buildPinElement(colorHex, icon);

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