/**
 * app.js — Application bootstrap
 */

import { initMap, addInvisibleClickLayer, onPinClick } from "./map.js";
import { initThreeOverlay, normaliseProps } from "./pins.js";
import { loadAndRenderEvents, openEventDetail, initCreateEventModal } from "./events.js";
import {
  fetchCategories,
  renderCategoryFilters,
  initDateFilters,
  initFreeFilter,
  initSearchFilter,
} from "./filters.js";

let defaultCityId = null;

async function bootstrap() {
  // 1. Init Mapbox map
  const map = await initMap();
  if (!map) return;

  // 2. Wait for map to be ready
  window.addEventListener(
    "map:ready",
    async () => {
      // 3. Init pin overlay (no-op if using DOM markers)
      initThreeOverlay();

      // 4. Invisible click layer (fallback for Mapbox events)
      addInvisibleClickLayer();

      // 5. Categories
      const categories = await fetchCategories();
      renderCategoryFilters(categories);

      // 6. Filter controls
      initDateFilters();
      initFreeFilter();
      initSearchFilter();

      // 7. Load Porto Alegre city id
      try {
        const cityResp = await fetch("/api/cities/porto-alegre/");
        if (cityResp.ok) {
          const city = await cityResp.json();
          defaultCityId = city.id;
        }
      } catch (e) {
        console.warn("Could not load Porto Alegre city data:", e);
      }

      // 8. Load events onto map
      await loadAndRenderEvents();

      // 9a. Pin click (DOM Marker via custom event)
      window.addEventListener("pin:clicked", (e) => {
        openEventDetail(e.detail.eventData, e.detail.coords);
      });

      // 9b. Invisible Mapbox layer click (fallback)
      onPinClick((props) => {
        const coords = props._coordinates;
        openEventDetail(props, coords);
      });

      // 10. Create-event modal
      initCreateEventModal(categories, defaultCityId);

      // 11. Auth changes → reload events
      window.addEventListener("auth:login", loadAndRenderEvents);
      window.addEventListener("auth:logout", loadAndRenderEvents);
    },
    { once: true }   // ← CRÍTICO: evita registrar handlers duplicados
  );

  // 12. "Meus eventos" — registrado FORA do map:ready para não duplicar
  window.addEventListener("show:my-events", handleShowMyEvents);
}

async function handleShowMyEvents() {
  try {
    const authModule = await import("./auth.js");
    const token = authModule.getAccessToken?.();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const resp = await fetch("/api/events/mine/", { headers });
    if (!resp.ok) throw new Error(`${resp.status}`);

    const geojson = await resp.json();
    const features = geojson.features || [];

    if (features.length === 0) {
      const { showToast } = await import("./auth.js");
      showToast("Você ainda não criou eventos.", "info");
      return;
    }

    // Show first event in sidebar
    // GeoFeatureModelSerializer puts PK at feature.id, not properties.id
    const f = features[0];
    const props = { ...(f.properties || {}) };
    if (!props.id && f.id) props.id = f.id;
    openEventDetail(props, f.geometry?.coordinates);
  } catch (e) {
    console.warn("show:my-events error:", e);
  }
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}